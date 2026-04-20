// graph-kinds/function-kind.js
//
// Handler for 'function' kind graphs.

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";
import { toWGSLType } from "../nodes/PortTypes.js";

const GENERIC_ALPHABET = "TUVWXYZABCDEFGHIJKLMNOPQRS";

// A type is concrete if it's longer than one character (user generics are single letters).
function isConcreteType(type) {
  return typeof type === "string" && type.length > 1;
}

// Stable 6-char hex hash of a string.
function shortHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).slice(0, 6).padStart(6, "0");
}

// Convert a string to a valid GLSL/WGSL identifier.
export function sanitizeId(str) {
  return String(str)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([^a-zA-Z_])/, "_$1");
}

export const functionKindHandler = {
  kind: "function",
  label: "Function",
  defaultColor: "#4a9eff",

  // ---- Contract ----

  validateContract(contract) {
    const errors = [];
    const names = new Set();
    for (const port of [...(contract.inputs || []), ...(contract.outputs || [])]) {
      if (!port.name || !port.name.trim()) {
        errors.push("Port name cannot be empty");
      } else if (names.has(port.name)) {
        errors.push(`Duplicate port name: "${port.name}"`);
      }
      names.add(port.name);
      if (!port.type) errors.push(`Port "${port.name || "?"}" has no type`);
    }
    return errors;
  },

  defaultPort(existingPorts) {
    const usedTypes = new Set((existingPorts || []).map((p) => p.type));
    let genericName = "T";
    for (const letter of GENERIC_ALPHABET) {
      if (!usedTypes.has(letter)) { genericName = letter; break; }
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return { id, name: "value", type: genericName };
  },

  renderContractEditor(graph, host, container) {
    // Phase 4
  },

  // ---- Boundary nodes ----

  bootstrapGraph(graph, host) {
    host._withGraph(graph, () => {
      host.addNode(-150, 100, FunctionInputNode);
      host.addNode(150, 100, FunctionOutputNode);
    });
    this.enforceBoundaryRules(graph, host);
  },

  enforceBoundaryRules(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const inputNode = graph.nodes.find((n) => n.nodeType === FunctionInputNode);
    const outputNode = graph.nodes.find((n) => n.nodeType === FunctionOutputNode);
    if (!inputNode || !outputNode) return;

    host._rebuildBoundaryNodePorts(
      inputNode,
      [],
      contract.inputs.map((p) => ({ name: p.name, type: p.type, contractPortId: p.id }))
    );
    host._rebuildBoundaryNodePorts(
      outputNode,
      contract.outputs.map((p) => ({ name: p.name, type: p.type, contractPortId: p.id })),
      []
    );
  },

  // ---- Caller node-type factory ----

  createCallerNodeType(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    return {
      name: graph.name,
      inputs: contract.inputs.map((p) => ({ name: p.name, type: p.type, contractPortId: p.id })),
      outputs: contract.outputs.map((p) => ({ name: p.name, type: p.type, contractPortId: p.id })),
      color: graph.color || this.defaultColor,
      category: "Functions",
      tags: ["function call", graph.name.toLowerCase()],
      isFunctionCall: true,
      callerKind: "function",
      targetGraphId: graph.id,
      contractVersion: graph.contractVersion,
      noTranslation: { name: true, ports: true, operations: false },
      getDependency: () => "",
      getExecution: () => null,
    };
  },

  callerSearchPrefix: "function_call",

  // ---- Codegen ----

  computeCallSiteSignature(callerNode, host) {
    const targetGraph = host.graphs.get(callerNode.nodeType.targetGraphId);
    const contract = targetGraph?.data?.contract || { inputs: [], outputs: [] };

    // Resolve concrete input types at this call site
    const inputTypes = callerNode.inputPorts.map((port, i) => {
      if (port.connections.length > 0) {
        return port.connections[0].startPort.getResolvedType();
      }
      const cp = contract.inputs[i];
      return isConcreteType(cp?.type) ? cp.type : "float";
    });

    // Build generic bindings: letter -> concrete type
    const bindings = {};
    contract.inputs.forEach((p, i) => {
      if (!isConcreteType(p.type)) bindings[p.type] = inputTypes[i] || "float";
    });

    // Resolve output types using bindings
    const outputTypes = contract.outputs.map((p) => {
      if (isConcreteType(p.type)) return p.type;
      return bindings[p.type] || "float";
    });

    const sigStr = inputTypes.join(",") + "->" + outputTypes.join(",");
    const sigHash = shortHash(sigStr);

    const hasGenerics = contract.inputs.some((p) => !isConcreteType(p.type));

    return { sigHash, inputTypes, outputTypes, bindings, sigStr, hasGenerics };
  },

  // Returns { declaration: string, deps: Map<string,Set<string>> }
  emitFunctionDeclaration(graph, signature, target, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const { sigHash, inputTypes, outputTypes, bindings, hasGenerics } = signature;

    if (outputTypes.length === 0) return { declaration: "", deps: new Map() };

    // Resolve concrete types from bindings
    const resolvedIn = contract.inputs.map((p, i) =>
      isConcreteType(p.type) ? p.type : (bindings[p.type] || inputTypes[i] || "float")
    );
    const resolvedOut = contract.outputs.map((p, i) =>
      isConcreteType(p.type) ? p.type : (bindings[p.type] || outputTypes[i] || "float")
    );

    const fnName = hasGenerics
      ? `fn_${sanitizeId(graph.id)}_${sigHash}`
      : `fn_${sanitizeId(graph.id)}`;

    const { bodyCode, deps } = host._compileFunctionBody(graph, {
      ...signature,
      resolvedInputTypes: resolvedIn,
      resolvedOutputTypes: resolvedOut,
      fnName,
    }, target);

    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOut.length === 1;
    let declaration = "";

    if (isWebGPU) {
      const params = contract.inputs
        .map((p, i) => `${sanitizeId(p.name)}: ${toWGSLType(resolvedIn[i])}`)
        .join(", ");
      if (singleOut) {
        declaration = `fn ${fnName}(${params}) -> ${toWGSLType(resolvedOut[0])} {\n${bodyCode}}\n`;
      } else {
        const structName = `${fnName}_Out`;
        const structDef =
          `struct ${structName} { ` +
          resolvedOut.map((t, i) => `o${i}: ${toWGSLType(t)}`).join(", ") +
          " };\n";
        declaration = `${structDef}fn ${fnName}(${params}) -> ${structName} {\n${bodyCode}}\n`;
      }
    } else {
      const params = contract.inputs
        .map((p, i) => `${resolvedIn[i]} ${sanitizeId(p.name)}`)
        .join(", ");
      if (singleOut) {
        declaration = `${resolvedOut[0]} ${fnName}(${params}) {\n${bodyCode}}\n`;
      } else {
        const outParams = resolvedOut
          .map((t, i) => `out ${t} out_${sanitizeId(contract.outputs[i].name)}`)
          .join(", ");
        const allParams = [params, outParams].filter(Boolean).join(", ");
        declaration = `void ${fnName}(${allParams}) {\n${bodyCode}}\n`;
      }
    }

    return { declaration, deps };
  },

  emitCallSite(callerNode, signature, ctx) {
    const { target, portToVarName, fnName, host } = ctx;
    const { resolvedOutputTypes } = signature;
    const targetGraph = host.graphs.get(callerNode.nodeType.targetGraphId);
    const contract = targetGraph?.data?.contract || { outputs: [] };
    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOutputTypes.length === 1;

    const inputVars = callerNode.inputPorts.map((p) => portToVarName.get(p) || "0.0");
    const outputVars = callerNode.outputPorts.map((p) => portToVarName.get(p));

    let code = "";

    if (singleOut) {
      const outType = resolvedOutputTypes[0];
      const outVar = outputVars[0];
      if (isWebGPU) {
        code = `    let ${outVar} = ${fnName}(${inputVars.join(", ")});`;
      } else {
        code = `    ${outType} ${outVar} = ${fnName}(${inputVars.join(", ")});`;
      }
    } else if (resolvedOutputTypes.length > 1) {
      if (isWebGPU) {
        const tmp = `_tmp_${outputVars[0] || "r"}`;
        code = `    let ${tmp} = ${fnName}(${inputVars.join(", ")});\n`;
        outputVars.forEach((v, i) => { code += `    let ${v} = ${tmp}.o${i};\n`; });
        code = code.trimEnd();
      } else {
        // GLSL out-params: declare, then call
        resolvedOutputTypes.forEach((t, i) => { code += `    ${t} ${outputVars[i]};\n`; });
        code += `    ${fnName}(${inputVars.join(", ")}, ${outputVars.join(", ")});`;
      }
    } else {
      code = `    // FunctionCall: no outputs`;
    }

    return code;
  },
};
