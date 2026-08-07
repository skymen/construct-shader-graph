// graph-kinds/function-kind.js
//
// Handler for 'function' kind graphs.

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";
import { toWGSLType } from "../nodes/PortTypes.js";
import {
  isConcreteType,
  isKnownType,
  shortHash,
  sanitizeId,
  newPortId,
  pickFreeGenericType,
} from "./contract.js";
import { renderContractEditor as renderSharedContractEditor } from "./contract-editor.js";

// Re-exported because loop-body-kind and script.js have long imported it from
// here. Its home is contract.js now.
export { sanitizeId };

export const functionKindHandler = {
  kind: "function",
  label: "Function",
  defaultColor: "#4a9eff",

  // ---- Contract ----

  // A function's inputs and outputs become two separate parameter lists, and
  // emitted params are prefixed in_/out_, so a name only has to be unique
  // within its own side.
  validateContract(contract) {
    const errors = [];
    for (const which of ["inputs", "outputs"]) {
      const names = new Set();
      for (const port of contract[which] || []) {
        if (!port.name || !port.name.trim()) {
          errors.push("Port name cannot be empty");
        } else if (names.has(port.name)) {
          errors.push(`Duplicate port name: "${port.name}"`);
        }
        names.add(port.name);
        if (!port.type) errors.push(`Port "${port.name || "?"}" has no type`);
        else if (!isKnownType(port.type)) {
          errors.push(`Port "${port.name}" has unknown type "${port.type}"`);
        }
      }
    }
    return errors;
  },

  defaultPort(existingPorts) {
    return {
      id: newPortId(),
      name: "value",
      type: pickFreeGenericType(existingPorts),
    };
  },

  renderContractEditor(graph, host, container) {
    // `container` is { infoForm, inputsList, outputsList }.
    renderSharedContractEditor(this, graph, host, container);
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
    const outputNode = graph.nodes.find(
      (n) => n.nodeType === FunctionOutputNode,
    );
    if (!inputNode || !outputNode) return;

    host._rebuildBoundaryNodePorts(
      inputNode,
      [],
      contract.inputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
    );
    host._rebuildBoundaryNodePorts(
      outputNode,
      contract.outputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
      [],
    );
  },

  // ---- Caller node-type factory ----

  createCallerNodeType(graph, host) {
    // Tolerate a partial contract: these can be hand-built through the console
    // API or come from a truncated file, and a missing key should not take the
    // whole sidebar down.
    const contract = graph.data?.contract || {};
    const inputs = contract.inputs || [];
    const outputs = contract.outputs || [];
    return {
      name: graph.name,
      inputs: inputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
      outputs: outputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
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

    // Build generic bindings: letter -> concrete type (from inputs first)
    const bindings = {};
    contract.inputs.forEach((p, i) => {
      if (!isConcreteType(p.type)) bindings[p.type] = inputTypes[i] || "float";
    });

    // Also resolve from output port connections for generics not bound by inputs
    contract.outputs.forEach((p, i) => {
      if (isConcreteType(p.type) || bindings[p.type]) return;
      const port = callerNode.outputPorts[i];
      if (port && port.connections.length > 0) {
        bindings[p.type] =
          port.connections[0].endPort.getResolvedType() || "float";
      }
    });

    // Resolve output types using bindings
    const outputTypes = contract.outputs.map((p) => {
      if (isConcreteType(p.type)) return p.type;
      return bindings[p.type] || "float";
    });

    const sigStr = inputTypes.join(",") + "->" + outputTypes.join(",");
    const sigHash = shortHash(sigStr);

    const hasGenerics =
      contract.inputs.some((p) => !isConcreteType(p.type)) ||
      contract.outputs.some((p) => !isConcreteType(p.type));

    const fnName = hasGenerics
      ? `fn_${sanitizeId(targetGraph?.id || "")}_${sigHash}`
      : `fn_${sanitizeId(targetGraph?.id || "")}`;

    // Resolve concrete types from bindings (used by emitFunctionDeclaration)
    const resolvedInputTypes = contract.inputs.map((p, i) =>
      isConcreteType(p.type)
        ? p.type
        : bindings[p.type] || inputTypes[i] || "float",
    );
    const resolvedOutputTypes = contract.outputs.map((p, i) =>
      isConcreteType(p.type)
        ? p.type
        : bindings[p.type] || outputTypes[i] || "float",
    );

    return {
      sigHash,
      sigStr,
      hasGenerics,
      fnName,
      inputTypes,
      outputTypes,
      bindings,
      resolvedInputTypes,
      resolvedOutputTypes,
    };
  },

  // Returns { declaration: string, deps: Map<string,Set<string>> }
  emitFunctionDeclaration(graph, signature, target, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const { outputTypes, fnName } = signature;

    if (outputTypes.length === 0) return { declaration: "", deps: new Map() };

    // Signatures built by computeCallSiteSignature carry resolvedInputTypes /
    // resolvedOutputTypes. Older test fixtures pass them in directly, so fall
    // back to the signature fields if present.
    const resolvedIn = signature.resolvedInputTypes || [];
    const resolvedOut = signature.resolvedOutputTypes || [];

    const { bodyCode, deps } = host._compileFunctionBody(
      graph,
      signature,
      target,
    );

    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOut.length === 1;
    let declaration = "";

    if (isWebGPU) {
      const userParams = contract.inputs
        .map((p, i) => `in_${sanitizeId(p.name)}: ${toWGSLType(resolvedIn[i])}`)
        .join(", ");
      // Prepend implicit input: FragmentInput so nodes that read varyings
      // (e.g. FrontUV → input.fragUV) work inside function bodies.
      const params = userParams
        ? `input: FragmentInput, ${userParams}`
        : "input: FragmentInput";
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
        .map((p, i) => `${resolvedIn[i]} in_${sanitizeId(p.name)}`)
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

    const inputVars = callerNode.inputPorts.map(
      (p) => portToVarName.get(p) || "0.0",
    );
    const outputVars = callerNode.outputPorts.map((p) => portToVarName.get(p));

    // WGSL: thread `input` (FragmentInput) through so varying-reading nodes work.
    const allArgs = isWebGPU ? ["input", ...inputVars] : inputVars;

    let code = "";

    if (singleOut) {
      const outType = resolvedOutputTypes[0];
      const outVar = outputVars[0];
      if (isWebGPU) {
        code = `    let ${outVar} = ${fnName}(${allArgs.join(", ")});`;
      } else {
        code = `    ${outType} ${outVar} = ${fnName}(${allArgs.join(", ")});`;
      }
    } else if (resolvedOutputTypes.length > 1) {
      if (isWebGPU) {
        const tmp = `_tmp_${outputVars[0] || "r"}`;
        code = `    let ${tmp} = ${fnName}(${allArgs.join(", ")});\n`;
        outputVars.forEach((v, i) => {
          code += `    let ${v} = ${tmp}.o${i};\n`;
        });
        code = code.trimEnd();
      } else {
        // GLSL out-params: declare, then call
        resolvedOutputTypes.forEach((t, i) => {
          code += `    ${t} ${outputVars[i]};\n`;
        });
        code += `    ${fnName}(${inputVars.join(", ")}, ${outputVars.join(", ")});`;
      }
    } else {
      code = `    // FunctionCall: no outputs`;
    }

    return code;
  },
};
