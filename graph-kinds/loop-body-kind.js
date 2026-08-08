// graph-kinds/loop-body-kind.js
//
// Handler for 'loopBody' kind graphs.
// Implements the handler interface defined in the plan (§5.1).

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
import {
  renderContractEditor as renderSharedContractEditor,
  buildLabeledRow,
} from "./contract-editor.js";
import { resolveConstantCount } from "../constant-fold.js";

// GLSL ES 1.00 (WebGL 1) Appendix A restricts a for loop to a single index
// compared against a *constant expression*, so `_i < someUniform` will not
// compile. A conditional break inside the body is allowed, so a dynamic count
// becomes a constant-bounded loop that breaks early. This is the fallback cap it
// runs to; iterations past it never execute.
//
// The cap is only ever reached by a count that genuinely is not knowable at
// codegen time. A count that folds (see constant-fold.js) becomes an exact
// bound with no cap and no break.
export const WEBGL1_MAX_LOOP_ITERATIONS = 64;

// Which cap applies to one caller, most specific first:
//
//   1. callerNode.data.maxIterations   per call site. Predates the sidebar field
//                                      and is reachable only from the console
//                                      API; kept so existing graphs and scripts
//                                      keep working.
//   2. graph.data.maxWebgl1Iterations  per loop body, set in its sidebar. The
//                                      one users are expected to reach for.
//   3. WEBGL1_MAX_LOOP_ITERATIONS      64.
export function resolveLoopCap(callerNode, targetGraph) {
  const perNode = callerNode?.data?.maxIterations;
  if (Number.isFinite(perNode)) return Math.max(1, Math.floor(perNode));

  const perGraph = targetGraph?.data?.maxWebgl1Iterations;
  if (Number.isFinite(perGraph)) return Math.max(1, Math.floor(perGraph));

  return WEBGL1_MAX_LOOP_ITERATIONS;
}

// A loop body's contract stores each thing exactly once:
//
//   contract.outputs  accumulators — carried across iterations. Each derives
//                     THREE ports: a body input (this iteration's value), a
//                     body output (next iteration's value) and "Initial <name>"
//                     on the caller.
//   contract.inputs   arguments — loop-invariant values passed in. One body
//                     input port, one caller input port.
//
// Which list an entry is in is what makes it an accumulator or an argument;
// there is no `role` field. Accumulators used to be stored twice — once in each
// list, paired by id — which let their name, type and *order* drift apart, and
// left the add/delete buttons able to produce unpairable states.
//
// Everything below reads through these two accessors so "output i is
// accumulator i" is true by construction rather than by convention.
function accumulators(contract) {
  return contract?.outputs || [];
}
function loopArgs(contract) {
  return contract?.inputs || [];
}

// Index and Count are always prepended to the FunctionInput outputs of a loop body.
// They are not stored in the contract; they are injected by enforceBoundaryRules.
const INDEX_PORT_DEF = {
  name: "Index",
  type: "int",
  contractPortId: "__loop_index__",
};
const COUNT_PORT_DEF = {
  name: "Count",
  type: "int",
  contractPortId: "__loop_count__",
};

/**
 * Loop body kind handler.
 */
export const loopBodyKindHandler = {
  kind: "loopBody",
  label: "Loop Body",
  defaultColor: "#e67e22",

  // ---- Contract ----

  validateContract(contract) {
    const errors = [];
    // Accumulators and arguments both become body input parameters, alongside
    // the injected Index/Count, so names have to be unique across BOTH lists
    // and must not collide with the injected pair.
    const names = new Set(
      [INDEX_PORT_DEF, COUNT_PORT_DEF].map((p) => p.name.toLowerCase()),
    );
    for (const port of [...accumulators(contract), ...loopArgs(contract)]) {
      const key = (port.name || "").trim().toLowerCase();
      if (!key) {
        errors.push("Port name cannot be empty");
      } else if (names.has(key)) {
        errors.push(`Duplicate port name: "${port.name}"`);
      }
      names.add(key);
      if (!port.type) errors.push(`Port "${port.name || "?"}" has no type`);
      else if (!isKnownType(port.type)) {
        errors.push(`Port "${port.name}" has unknown type "${port.type}"`);
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

  // ---- Editor / sidebar ----

  // A loop body's two lists hold different things from a function's, so they
  // get different words; the editor itself is the same.
  sectionLabels: {
    inputs: "Arguments",
    outputs: "Accumulators",
    addInput: "+ Add Argument",
    addOutput: "+ Add Accumulator",
  },

  renderContractEditor(graph, host, container) {
    renderSharedContractEditor(this, graph, host, container);
  },

  // Only meaningful for loops, so it lives here rather than in the shared info
  // form. Applies to every call site of this loop body; a single call site can
  // still override it through `nodes.edit(id, { data: { maxIterations: N } })`.
  renderExtraInfoRows(graph, host, form) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.placeholder = String(WEBGL1_MAX_LOOP_ITERATIONS);
    input.title =
      "WebGL1 cannot compare a loop index against a computed value, so a " +
      "loop whose Count is not knowable at codegen time runs to this cap and " +
      "breaks out early. A Count that is knowable ignores this entirely.";

    const stored = graph.data?.maxWebgl1Iterations;
    input.value = Number.isFinite(stored) ? String(stored) : "";

    input.addEventListener("change", () => {
      const raw = input.value.trim();
      const next =
        raw.length === 0 ? undefined : Math.max(1, Math.floor(Number(raw)));

      // A non-numeric entry reverts rather than writing NaN onto the graph.
      if (next !== undefined && !Number.isFinite(next)) {
        input.value = Number.isFinite(graph.data?.maxWebgl1Iterations)
          ? String(graph.data.maxWebgl1Iterations)
          : "";
        return;
      }

      if (!graph.data) graph.data = {};
      if (graph.data.maxWebgl1Iterations === next) return;

      if (next === undefined) delete graph.data.maxWebgl1Iterations;
      else graph.data.maxWebgl1Iterations = next;

      input.value = next === undefined ? "" : String(next);
      host.onShaderChanged?.();
      host.history?.pushState("Edit loop iteration cap");
    });

    form.appendChild(buildLabeledRow("Max WebGL1 Iterations", input));
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

    const asDef = (p) => ({
      name: p.name,
      type: p.type,
      contractPortId: p.id,
    });

    // The body reads Index and Count, then each accumulator's current value,
    // then the arguments. It writes each accumulator's next value.
    const inputOutputDefs = [
      INDEX_PORT_DEF,
      COUNT_PORT_DEF,
      ...accumulators(contract).map(asDef),
      ...loopArgs(contract).map(asDef),
    ];
    const outputInputDefs = accumulators(contract).map(asDef);

    host._rebuildBoundaryNodePorts(inputNode, [], inputOutputDefs);
    host._rebuildBoundaryNodePorts(outputNode, outputInputDefs, []);
  },

  // ---- Caller node-type factory ----

  createCallerNodeType(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const accs = accumulators(contract);
    const argInputs = loopArgs(contract);

    // ForLoop inputs: Count, then "Initial <acc>" per accumulator, then args.
    const inputs = [
      { name: "Count", type: "int", contractPortId: "__count__" },
      ...accs.map((p) => ({
        name: `Initial ${p.name}`,
        type: p.type,
        contractPortId: `init_${p.id}`,
      })),
      ...argInputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
    ];

    // ForLoop outputs: the accumulators' final values — same list, same order,
    // so caller output i always belongs to accumulator i.
    const outputs = accs.map((p) => ({
      name: p.name,
      type: p.type,
      contractPortId: p.id,
    }));

    return {
      name: graph.name,
      inputs,
      outputs,
      color: graph.color || this.defaultColor,
      category: "Functions",
      tags: ["for loop", "loop body", graph.name.toLowerCase()],
      isFunctionCall: true,
      callerKind: "loopBody",
      targetGraphId: graph.id,
      contractVersion: graph.contractVersion,
      noTranslation: { name: true, ports: true, operations: false },
      getDependency: () => "",
      getExecution: () => null,
    };
  },

  callerSearchPrefix: "for_loop",

  // ---- Codegen ----

  computeCallSiteSignature(callerNode, host) {
    const targetGraph = host.graphs.get(callerNode.nodeType.targetGraphId);
    const contract = targetGraph?.data?.contract || { inputs: [], outputs: [] };
    const accInputs = accumulators(contract);
    const argInputs = loopArgs(contract);

    // Caller input ports order: Count, Initial acc0, Initial acc1, ..., arg0, arg1, ...
    // Skip Count (index 0), then accumulators, then args
    const callerPorts = callerNode.inputPorts;

    // Resolve accumulator types from the "Initial <acc>" ports
    const accTypes = accInputs.map((p, i) => {
      const portIdx = 1 + i; // skip Count
      const port = callerPorts[portIdx];
      if (port && port.connections.length > 0) {
        return port.connections[0].startPort.getResolvedType();
      }
      return isConcreteType(p.type) ? p.type : "float";
    });

    // Resolve arg types
    const argTypes = argInputs.map((p, i) => {
      const portIdx = 1 + accInputs.length + i; // skip Count + accs
      const port = callerPorts[portIdx];
      if (port && port.connections.length > 0) {
        return port.connections[0].startPort.getResolvedType();
      }
      return isConcreteType(p.type) ? p.type : "float";
    });

    // Build generic bindings
    const bindings = {};
    accInputs.forEach((p, i) => {
      if (!isConcreteType(p.type)) bindings[p.type] = accTypes[i] || "float";
    });
    argInputs.forEach((p, i) => {
      if (!isConcreteType(p.type)) bindings[p.type] = argTypes[i] || "float";
    });

    // The outputs ARE the accumulators, so their resolved types are the ones
    // already computed above. Nothing to look up, nothing to fall back to.
    const outputTypes = accTypes;

    // Full function signature: int (Index), int (Count), then acc types, then arg types
    // This is the parameter list of the emitted function
    const allInputTypes = ["int", "int", ...accTypes, ...argTypes];
    const sigStr = allInputTypes.join(",") + "->" + outputTypes.join(",");
    const sigHash = shortHash(sigStr);

    const hasGenerics = [...accInputs, ...argInputs].some(
      (p) => !isConcreteType(p.type),
    );

    const fnName = hasGenerics
      ? `fn_${sanitizeId(targetGraph?.id || "")}_${sigHash}`
      : `fn_${sanitizeId(targetGraph?.id || "")}`;

    // resolvedInputTypes = for the emitted function params: int(Index), int(Count), acc..., arg...
    const resolvedInputTypes = allInputTypes;
    // resolvedOutputTypes = acc outputs
    const resolvedOutputTypes = outputTypes;

    return {
      sigHash,
      sigStr,
      hasGenerics,
      fnName,
      inputTypes: allInputTypes,
      outputTypes,
      bindings,
      resolvedInputTypes,
      resolvedOutputTypes,
      accInputs,
      argInputs,
      accTypes,
      argTypes,
    };
  },

  emitFunctionDeclaration(graph, signature, target, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const { outputTypes, fnName } = signature;

    if (outputTypes.length === 0) return { declaration: "", deps: new Map() };

    const resolvedOut = signature.resolvedOutputTypes || [];
    const accInputs = signature.accInputs || accumulators(contract);
    const argInputs = signature.argInputs || loopArgs(contract);
    const accTypes =
      signature.accTypes ||
      accInputs.map((p) => (isConcreteType(p.type) ? p.type : "float"));
    const argTypes =
      signature.argTypes ||
      argInputs.map((p) => (isConcreteType(p.type) ? p.type : "float"));

    // _compileFunctionBody expects a signature with resolvedInputTypes matching
    // how the FunctionInput output ports are laid out.
    // For loop bodies, FunctionInput outputs = [Index, Count, ...contract.inputs]
    // So resolvedInputTypes for the body compiler = [int, int, acc0Type, ..., arg0Type, ...]
    const bodySignature = {
      ...signature,
      resolvedInputTypes: ["int", "int", ...accTypes, ...argTypes],
      resolvedOutputTypes: resolvedOut,
    };

    const { bodyCode, deps } = host._compileFunctionBody(
      graph,
      bodySignature,
      target,
    );

    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOut.length === 1;

    // Build parameter list: Index first, then Count, then accs, then args
    // Every contract-derived parameter is prefixed in_/out_, so a port named
    // `i` or `n` cannot shadow the injected index/count, and an input named
    // `out_x` cannot collide with an output named `x`.
    const paramEntries = [];
    paramEntries.push({ name: "i", type: "int" }); // Index
    paramEntries.push({ name: "n", type: "int" }); // Count
    accInputs.forEach((p, idx) =>
      paramEntries.push({
        name: `in_${sanitizeId(p.name)}`,
        type: accTypes[idx],
      }),
    );
    argInputs.forEach((p, idx) =>
      paramEntries.push({
        name: `in_${sanitizeId(p.name)}`,
        type: argTypes[idx],
      }),
    );

    let declaration = "";

    if (isWebGPU) {
      const userParams = paramEntries
        .map((e) => `${e.name}: ${toWGSLType(e.type)}`)
        .join(", ");
      const params = `input: FragmentInput, ${userParams}`;
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
      // GLSL
      const inParams = paramEntries
        .map((e) => `${e.type} ${e.name}`)
        .join(", ");
      if (singleOut) {
        declaration = `${resolvedOut[0]} ${fnName}(${inParams}) {\n${bodyCode}}\n`;
      } else {
        const outParams = resolvedOut
          .map(
            (t, i) =>
              `out ${t} out_${sanitizeId(accumulators(contract)[i].name)}`,
          )
          .join(", ");
        const allParams = [inParams, outParams].filter(Boolean).join(", ");
        declaration = `void ${fnName}(${allParams}) {\n${bodyCode}}\n`;
      }
    }

    return { declaration, deps };
  },

  emitCallSite(callerNode, signature, ctx) {
    const { target, portToVarName, fnName, host } = ctx;
    const { resolvedOutputTypes } = signature;
    const targetGraph = host.graphs.get(callerNode.nodeType.targetGraphId);
    const contract = targetGraph?.data?.contract || { inputs: [], outputs: [] };
    const accInputs = signature.accInputs || accumulators(contract);
    const argInputs = signature.argInputs || loopArgs(contract);
    const accTypes =
      signature.accTypes ||
      accInputs.map((p) => (isConcreteType(p.type) ? p.type : "float"));

    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOutputTypes.length === 1;

    // Caller input ports: [Count, Initial acc0, ..., arg0, ...]
    const callerInputVars = callerNode.inputPorts.map(
      (p) => portToVarName.get(p) || "0.0",
    );
    const callerOutputVars = callerNode.outputPorts.map((p) =>
      portToVarName.get(p),
    );

    const countVar = callerInputVars[0]; // Count
    const initAccVars = accInputs.map((_, i) => callerInputVars[1 + i]);
    const argVars = argInputs.map(
      (_, i) => callerInputVars[1 + accInputs.length + i],
    );

    // The accumulator variable names used INSIDE the loop.
    // These are the caller's OUTPUT variables (final accumulator values).
    const accVars = callerOutputVars;

    let code = "";

    // Function args: _i (Index), countVar (Count), then accumulators, then args.
    // WGSL: prepend `input` (FragmentInput) so varying-reading nodes work.
    const bodyArgs = (vars) => {
      const base = ["_i", countVar, ...vars];
      return (isWebGPU ? ["input", ...base] : base).join(", ");
    };

    if (isWebGPU) {
      // Initialize accumulators
      accVars.forEach((v, i) => {
        code += `    var ${v}: ${toWGSLType(accTypes[i])} = ${initAccVars[i]};\n`;
      });

      // For loop
      code += `    for (var _i: i32 = 0; _i < ${countVar}; _i = _i + 1) {\n`;

      if (singleOut) {
        code += `        ${accVars[0]} = ${fnName}(${bodyArgs([...accVars, ...argVars])});\n`;
      } else {
        const tmp = `_loop_tmp_${accVars[0] || "r"}`;
        code += `        let ${tmp} = ${fnName}(${bodyArgs([...accVars, ...argVars])});\n`;
        accVars.forEach((v, i) => {
          code += `        ${v} = ${tmp}.o${i};\n`;
        });
      }

      code += `    }`;
    } else {
      // GLSL: initialize accumulators
      accVars.forEach((v, i) => {
        code += `    ${accTypes[i]} ${v} = ${initAccVars[i]};\n`;
      });

      // For loop. WebGL2 takes a computed bound directly; WebGL1 does not.
      if (target === "webgl1") {
        // Anything knowable at codegen time is a constant expression once we
        // write the number out, so it can be the bound as-is and the loop runs
        // exactly that many times. This covers a literal on the port, an Int
        // Input node, and arithmetic over either - all of which used to fall
        // through to the cap because the old check tested the *variable name*
        // for digits, and a node's output is always named var_N.
        const foldedCount = resolveConstantCount(callerNode.inputPorts[0], host);

        if (foldedCount !== null) {
          code += `    for (int _i = 0; _i < ${foldedCount}; _i++) {\n`;
        } else {
          const cap = resolveLoopCap(callerNode, targetGraph);
          code += `    // WebGL1 cannot compare a loop index against a computed value,\n`;
          code += `    // so the loop runs to a constant cap and breaks out early.\n`;
          code += `    for (int _i = 0; _i < ${cap}; _i++) {\n`;
          code += `        if (_i >= ${countVar}) { break; }\n`;
        }
      } else {
        code += `    for (int _i = 0; _i < ${countVar}; _i++) {\n`;
      }

      if (singleOut) {
        code += `        ${accVars[0]} = ${fnName}(${bodyArgs([...accVars, ...argVars])});\n`;
      } else {
        // Multi-output GLSL: out params write back into acc vars directly
        code += `        ${fnName}(${bodyArgs([...accVars, ...argVars, ...accVars])});\n`;
      }

      code += `    }`;
    }

    return code;
  },
};
