// graph-kinds/loop-body-kind.js
//
// Handler for 'loopBody' kind graphs.
// Implements the handler interface defined in the plan (§5.1).

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";
import { toWGSLType } from "../nodes/PortTypes.js";
import { sanitizeId } from "./function-kind.js";

const CONCRETE_TYPE_OPTIONS = [
  { value: "float", label: "Float" },
  { value: "int", label: "Int" },
  { value: "bool", label: "Bool" },
  { value: "vec2", label: "Vec2" },
  { value: "vec3", label: "Vec3" },
  { value: "vec4", label: "Vec4" },
  { value: "mat2", label: "Mat2" },
  { value: "mat3", label: "Mat3" },
  { value: "mat4", label: "Mat4" },
];

const GENERIC_ALPHABET = "TUVWXYZABCDEFGHIJKLMNOPQRS";

function isConcreteType(type) {
  return typeof type === "string" && type.length > 1;
}

function shortHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).slice(0, 6).padStart(6, "0");
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
const INJECTED_PORT_COUNT = 2; // Index + Count

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
    // Check for duplicates within inputs and within outputs separately,
    // since acc input/output pairs legitimately share the same name.
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
      }
    }

    // Loop body inputs must have a role
    for (const inp of contract.inputs || []) {
      if (inp.role !== "acc" && inp.role !== "arg") {
        errors.push(`Input "${inp.name || "?"}" must have role 'acc' or 'arg'`);
      }
    }

    // Every acc output must pair with an acc input by id
    const accInputIds = new Set(
      (contract.inputs || []).filter((p) => p.role === "acc").map((p) => p.id),
    );
    for (const out of contract.outputs || []) {
      if (!accInputIds.has(out.id)) {
        errors.push(`Output "${out.name}" has no matching accumulator input`);
      }
    }

    // Every acc input must have a paired output
    const outputIds = new Set((contract.outputs || []).map((p) => p.id));
    for (const inp of (contract.inputs || []).filter((p) => p.role === "acc")) {
      if (!outputIds.has(inp.id)) {
        errors.push(`Accumulator input "${inp.name}" has no matching output`);
      }
    }

    return errors;
  },

  defaultPort(existingPorts) {
    const usedTypes = new Set((existingPorts || []).map((p) => p.type));
    let genericName = "T";
    for (const letter of GENERIC_ALPHABET) {
      if (!usedTypes.has(letter)) {
        genericName = letter;
        break;
      }
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return { id, name: "value", type: genericName, role: "acc" };
  },

  // ---- Editor / sidebar ----

  renderContractEditor(graph, host, container) {
    renderLoopBodyContractEditor(this, graph, host, container);
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

    // Index and Count are always first; then acc/arg contract inputs
    const inputOutputDefs = [
      INDEX_PORT_DEF,
      COUNT_PORT_DEF,
      ...contract.inputs.map((p) => ({
        name: p.name,
        type: p.type,
        contractPortId: p.id,
      })),
    ];
    const outputInputDefs = contract.outputs.map((p) => ({
      name: p.name,
      type: p.type,
      contractPortId: p.id,
    }));

    host._rebuildBoundaryNodePorts(inputNode, [], inputOutputDefs);
    host._rebuildBoundaryNodePorts(outputNode, outputInputDefs, []);
  },

  // ---- Caller node-type factory ----

  createCallerNodeType(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const accInputs = contract.inputs.filter((p) => p.role === "acc");
    const argInputs = contract.inputs.filter((p) => p.role === "arg");

    // ForLoop inputs: Count (int), then "Initial <acc>" for each accumulator, then args
    const inputs = [
      { name: "Count", type: "int", contractPortId: "__count__" },
      ...accInputs.map((p) => ({
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

    // ForLoop outputs: one per acc output (which pair 1:1 with acc inputs)
    const outputs = contract.outputs.map((p) => ({
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
    const accInputs = contract.inputs.filter((p) => p.role === "acc");
    const argInputs = contract.inputs.filter((p) => p.role === "arg");

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

    // Resolve output types (acc outputs pair with acc inputs)
    const outputTypes = contract.outputs.map((p) => {
      if (isConcreteType(p.type)) return p.type;
      return bindings[p.type] || "float";
    });

    // Full function signature: int (Index), int (Count), then acc types, then arg types
    // This is the parameter list of the emitted function
    const allInputTypes = ["int", "int", ...accTypes, ...argTypes];
    const sigStr = allInputTypes.join(",") + "->" + outputTypes.join(",");
    const sigHash = shortHash(sigStr);

    const hasGenerics =
      contract.inputs.some((p) => !isConcreteType(p.type)) ||
      contract.outputs.some((p) => !isConcreteType(p.type));

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
    const accInputs =
      signature.accInputs || contract.inputs.filter((p) => p.role === "acc");
    const argInputs =
      signature.argInputs || contract.inputs.filter((p) => p.role === "arg");
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
    const paramEntries = [];
    paramEntries.push({ name: "i", type: "int" }); // Index
    paramEntries.push({ name: "n", type: "int" }); // Count
    accInputs.forEach((p, idx) =>
      paramEntries.push({ name: sanitizeId(p.name), type: accTypes[idx] }),
    );
    argInputs.forEach((p, idx) =>
      paramEntries.push({ name: sanitizeId(p.name), type: argTypes[idx] }),
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
          .map((t, i) => `out ${t} out_${sanitizeId(contract.outputs[i].name)}`)
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
    const accInputs =
      signature.accInputs || contract.inputs.filter((p) => p.role === "acc");
    const argInputs =
      signature.argInputs || contract.inputs.filter((p) => p.role === "arg");
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

      // For loop
      code += `    for (int _i = 0; _i < ${countVar}; _i++) {\n`;

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

// ---------- Contract editor UI ----------

function renderLoopBodyContractEditor(handler, graph, host, container) {
  const { infoForm, inputsList, outputsList } = container;
  renderInfoForm(handler, graph, host, infoForm);
  renderPortList(handler, graph, host, inputsList, "inputs");
  renderPortList(handler, graph, host, outputsList, "outputs");
}

function renderInfoForm(handler, graph, host, form) {
  if (!form) return;
  form.innerHTML = "";

  form.appendChild(
    buildLabeledRow(
      "Name",
      (() => {
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = graph.name || "";
        nameInput.addEventListener("change", () => {
          const v = nameInput.value.trim() || graph.name || "Untitled";
          if (v === graph.name) return;
          graph.name = v;
          host.syncContractCallers(graph);
          host.renderGraphTabBar && host.renderGraphTabBar();
          host.renderFunctionsList && host.renderFunctionsList();
          host.onShaderChanged && host.onShaderChanged();
        });
        return nameInput;
      })(),
    ),
  );

  form.appendChild(
    buildLabeledRow(
      "Color",
      (() => {
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = graph.color || handler.defaultColor;
        colorInput.addEventListener("change", () => {
          graph.color = colorInput.value;
          host.syncContractCallers(graph);
          host.renderGraphTabBar && host.renderGraphTabBar();
          host.renderFunctionsList && host.renderFunctionsList();
          host.render && host.render();
        });
        return colorInput;
      })(),
    ),
  );

  form.appendChild(
    buildLabeledRow(
      "Notes",
      (() => {
        const notes = document.createElement("textarea");
        notes.rows = 3;
        notes.value = graph.data?.notes || "";
        notes.addEventListener("change", () => {
          if (!graph.data) graph.data = {};
          graph.data.notes = notes.value;
        });
        return notes;
      })(),
    ),
  );
}

function buildLabeledRow(labelText, control) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  label.appendChild(span);
  label.appendChild(control);
  return label;
}

function renderPortList(handler, graph, host, listEl, which) {
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!graph.data) graph.data = {};
  if (!graph.data.contract) graph.data.contract = { inputs: [], outputs: [] };
  const ports = graph.data.contract[which] || (graph.data.contract[which] = []);

  ports.forEach((port, index) => {
    const row = buildPortRow(handler, graph, host, port, index, which);
    listEl.appendChild(row);
  });
}

function buildPortRow(handler, graph, host, port, index, which) {
  const row = document.createElement("div");
  row.className = "contract-port-row";
  row.draggable = true;
  row.dataset.index = String(index);
  row.dataset.which = which;

  // Drag handle
  const handle = document.createElement("div");
  handle.className = "contract-port-drag-handle";
  handle.textContent = "\u22EE\u22EE";
  handle.title = "Drag to reorder";
  row.appendChild(handle);

  // Name
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "contract-port-name";
  nameInput.value = port.name || "";
  nameInput.addEventListener("change", () => {
    const v = nameInput.value.trim();
    if (!v || v === port.name) {
      nameInput.value = port.name || "";
      return;
    }
    const dup = (graph.data.contract[which] || []).some(
      (p, i) => i !== index && p.name === v,
    );
    if (dup) {
      nameInput.value = port.name || "";
      return;
    }
    port.name = v;
    // If this is an acc input, also rename the paired output
    if (which === "inputs" && port.role === "acc") {
      const pairedOut = graph.data.contract.outputs.find(
        (o) => o.id === port.id,
      );
      if (pairedOut) pairedOut.name = v;
    }
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });
  row.appendChild(nameInput);

  // Type select
  const typeSelect = document.createElement("select");
  typeSelect.className = "contract-port-type";
  for (const opt of CONCRETE_TYPE_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    typeSelect.appendChild(o);
  }
  const genericOpt = document.createElement("option");
  genericOpt.value = "__generic__";
  genericOpt.textContent = "Generic";
  typeSelect.appendChild(genericOpt);

  const portIsGeneric = !isConcreteType(port.type);
  typeSelect.value = portIsGeneric ? "__generic__" : port.type;

  typeSelect.addEventListener("change", () => {
    const sel = typeSelect.value;
    if (sel === "__generic__") {
      if (!isConcreteType(port.type)) return;
      port.type = port._previousGeneric || pickFreeGenericLetter(graph);
      delete port._previousGeneric;
    } else {
      if (port.type === sel) return;
      if (!isConcreteType(port.type)) port._previousGeneric = port.type;
      port.type = sel;
    }
    // If this is an acc input, also update paired output type
    if (which === "inputs" && port.role === "acc") {
      const pairedOut = graph.data.contract.outputs.find(
        (o) => o.id === port.id,
      );
      if (pairedOut) pairedOut.type = port.type;
    }
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });
  row.appendChild(typeSelect);

  // Role selector (inputs only)
  if (which === "inputs") {
    const roleSelect = document.createElement("select");
    roleSelect.className = "contract-port-role-select";
    for (const r of ["acc", "arg"]) {
      const o = document.createElement("option");
      o.value = r;
      o.textContent = r === "acc" ? "Accumulator" : "Argument";
      roleSelect.appendChild(o);
    }
    roleSelect.value = port.role || "acc";
    roleSelect.addEventListener("change", () => {
      const oldRole = port.role;
      port.role = roleSelect.value;
      if (oldRole === "acc" && port.role === "arg") {
        // Remove paired output
        graph.data.contract.outputs = graph.data.contract.outputs.filter(
          (o) => o.id !== port.id,
        );
      } else if (oldRole === "arg" && port.role === "acc") {
        // Add paired output
        graph.data.contract.outputs.push({
          id: port.id,
          name: port.name,
          type: port.type,
        });
      }
      host.syncContractCallers(graph);
      host.renderContractEditor && host.renderContractEditor();
      host.render && host.render();
      host.onShaderChanged && host.onShaderChanged();
    });
    row.appendChild(roleSelect);
  }

  // Generic letter hint
  if (portIsGeneric) {
    const letter = document.createElement("span");
    letter.className = "contract-port-role";
    letter.textContent = port.type;
    row.appendChild(letter);
  }

  // Paired indicator (for outputs)
  if (which === "outputs") {
    const pairedInput = (graph.data.contract.inputs || []).find(
      (inp) => inp.id === port.id && inp.role === "acc",
    );
    if (pairedInput) {
      const hint = document.createElement("span");
      hint.className = "contract-port-resolved-hint";
      hint.textContent = `\u2194 ${pairedInput.name}`;
      row.appendChild(hint);
    }
  }

  // Delete
  const del = document.createElement("button");
  del.type = "button";
  del.className = "contract-port-delete";
  del.textContent = "\u00D7";
  del.title = "Remove port";
  del.addEventListener("click", () => {
    if (which === "inputs" && port.role === "acc") {
      // Also remove paired output
      graph.data.contract.outputs = graph.data.contract.outputs.filter(
        (o) => o.id !== port.id,
      );
    }
    graph.data.contract[which].splice(index, 1);
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.renderFunctionsList && host.renderFunctionsList();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });
  // Outputs that are auto-paired shouldn't be directly deletable
  if (which === "outputs") {
    del.disabled = true;
    del.title = "Delete the paired accumulator input to remove";
  }
  row.appendChild(del);

  // Drag-reorder handlers
  handle.addEventListener("mousedown", () => {
    row.dataset.dragArmed = "1";
  });
  row.addEventListener("mouseup", () => {
    delete row.dataset.dragArmed;
  });
  row.addEventListener("dragstart", (e) => {
    if (row.dataset.dragArmed !== "1") {
      e.preventDefault();
      return;
    }
    delete row.dataset.dragArmed;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/x-contract-port",
      JSON.stringify({ which, index }),
    );
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    row.classList.remove("drag-over-top", "drag-over-bottom");
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    row.classList.toggle("drag-over-top", e.clientY < midY);
    row.classList.toggle("drag-over-bottom", e.clientY >= midY);
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over-top", "drag-over-bottom");
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drag-over-top", "drag-over-bottom");
    let payload;
    try {
      payload = JSON.parse(
        e.dataTransfer.getData("text/x-contract-port") || "{}",
      );
    } catch {
      payload = {};
    }
    if (payload.which !== which) return;
    const from = payload.index;
    const rect = row.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    let to = index + (after ? 1 : 0);
    if (from < to) to--;
    if (from === to) return;
    const arr = graph.data.contract[which];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });

  return row;
}

function pickFreeGenericLetter(graph) {
  const used = new Set();
  const contract = graph.data?.contract || { inputs: [], outputs: [] };
  for (const p of [...(contract.inputs || []), ...(contract.outputs || [])]) {
    if (!isConcreteType(p.type)) used.add(p.type);
  }
  for (const letter of GENERIC_ALPHABET) {
    if (!used.has(letter)) return letter;
  }
  return "T";
}
