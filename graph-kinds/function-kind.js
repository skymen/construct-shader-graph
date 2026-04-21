// graph-kinds/function-kind.js
//
// Handler for 'function' kind graphs.

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";
import { toWGSLType } from "../nodes/PortTypes.js";

const CONCRETE_TYPE_OPTIONS = [
  { value: "float", label: "Float" },
  { value: "int",   label: "Int"   },
  { value: "bool",  label: "Bool"  },
  { value: "vec2",  label: "Vec2"  },
  { value: "vec3",  label: "Vec3"  },
  { value: "vec4",  label: "Vec4"  },
  { value: "mat2",  label: "Mat2"  },
  { value: "mat3",  label: "Mat3"  },
  { value: "mat4",  label: "Mat4"  },
];

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
    // `container` is { infoForm, inputsList, outputsList }.
    renderFunctionContractEditor(this, graph, host, container);
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

    const hasGenerics =
      contract.inputs.some((p) => !isConcreteType(p.type)) ||
      contract.outputs.some((p) => !isConcreteType(p.type));

    const fnName = hasGenerics
      ? `fn_${sanitizeId(targetGraph?.id || "")}_${sigHash}`
      : `fn_${sanitizeId(targetGraph?.id || "")}`;

    // Resolve concrete types from bindings (used by emitFunctionDeclaration)
    const resolvedInputTypes = contract.inputs.map((p, i) =>
      isConcreteType(p.type) ? p.type : (bindings[p.type] || inputTypes[i] || "float")
    );
    const resolvedOutputTypes = contract.outputs.map((p, i) =>
      isConcreteType(p.type) ? p.type : (bindings[p.type] || outputTypes[i] || "float")
    );

    return {
      sigHash, sigStr, hasGenerics, fnName,
      inputTypes, outputTypes, bindings,
      resolvedInputTypes, resolvedOutputTypes,
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

    const { bodyCode, deps } = host._compileFunctionBody(graph, signature, target);

    const isWebGPU = target === "webgpu";
    const singleOut = resolvedOut.length === 1;
    let declaration = "";

    if (isWebGPU) {
      const userParams = contract.inputs
        .map((p, i) => `${sanitizeId(p.name)}: ${toWGSLType(resolvedIn[i])}`)
        .join(", ");
      // Prepend implicit input: FragmentInput so nodes that read varyings
      // (e.g. FrontUV → input.fragUV) work inside function bodies.
      const params = userParams ? `input: FragmentInput, ${userParams}` : "input: FragmentInput";
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

// ---------- Contract editor UI ----------

function renderFunctionContractEditor(handler, graph, host, container) {
  const { infoForm, inputsList, outputsList } = container;
  renderInfoForm(handler, graph, host, infoForm);
  renderPortList(handler, graph, host, inputsList, "inputs");
  renderPortList(handler, graph, host, outputsList, "outputs");
}

function renderInfoForm(handler, graph, host, form) {
  if (!form) return;
  form.innerHTML = "";

  // Name
  form.appendChild(buildLabeledRow("Name", (() => {
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
  })()));

  // Color
  form.appendChild(buildLabeledRow("Color", (() => {
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
  })()));

  // Notes
  form.appendChild(buildLabeledRow("Notes", (() => {
    const notes = document.createElement("textarea");
    notes.rows = 3;
    notes.value = graph.data?.notes || "";
    notes.addEventListener("change", () => {
      if (!graph.data) graph.data = {};
      graph.data.notes = notes.value;
    });
    return notes;
  })()));
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
  const contract = graph.data.contract;
  const ports = contract[which] || (contract[which] = []);

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
    if (!v || v === port.name) { nameInput.value = port.name || ""; return; }
    // Reject duplicates within the same side.
    const dup = (graph.data.contract[which] || []).some(
      (p, i) => i !== index && p.name === v
    );
    if (dup) {
      nameInput.value = port.name || "";
      return;
    }
    port.name = v;
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
      if (!isConcreteType(port.type)) return; // already generic
      // Prefer the letter this port used before going concrete, so a
      // concrete→generic round-trip restores the original shared generic.
      port.type = port._previousGeneric || pickFreeGenericLetter(graph);
      delete port._previousGeneric;
    } else {
      if (port.type === sel) return;
      // Remember the current generic letter so we can restore it on revert.
      if (!isConcreteType(port.type)) port._previousGeneric = port.type;
      port.type = sel;
    }
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });
  row.appendChild(typeSelect);

  // Generic letter + resolved hint
  if (portIsGeneric) {
    const letter = document.createElement("span");
    letter.className = "contract-port-role";
    letter.textContent = port.type;
    row.appendChild(letter);

    const resolved = resolveGenericType(graph, port, which);
    if (resolved && resolved !== port.type) {
      const hint = document.createElement("span");
      hint.className = "contract-port-resolved-hint";
      hint.textContent = `\u2192 ${resolved}`;
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
    graph.data.contract[which].splice(index, 1);
    host.syncContractCallers(graph);
    host.renderContractEditor && host.renderContractEditor();
    host.renderFunctionsList && host.renderFunctionsList();
    host.render && host.render();
    host.onShaderChanged && host.onShaderChanged();
  });
  row.appendChild(del);

  // Drag-reorder handlers — only drag when grabbed by the handle.
  handle.addEventListener("mousedown", () => { row.dataset.dragArmed = "1"; });
  row.addEventListener("mouseup", () => { delete row.dataset.dragArmed; });
  row.addEventListener("dragstart", (e) => {
    if (row.dataset.dragArmed !== "1") { e.preventDefault(); return; }
    delete row.dataset.dragArmed;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/x-contract-port", JSON.stringify({ which, index }));
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
    try { payload = JSON.parse(e.dataTransfer.getData("text/x-contract-port") || "{}"); }
    catch { payload = {}; }
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

// Pick a single-letter generic name not currently used anywhere in the contract.
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

// For a generic contract port, read the resolved type from the boundary node
// inside the function graph, if any.
function resolveGenericType(graph, port, which) {
  const nodes = graph.nodes || [];
  const boundary =
    which === "inputs"
      ? nodes.find((n) => n.nodeType === FunctionInputNode)
      : nodes.find((n) => n.nodeType === FunctionOutputNode);
  if (!boundary) return null;
  // Contract inputs map to the input node's *output* ports;
  // contract outputs map to the output node's *input* ports.
  const portList = which === "inputs" ? boundary.outputPorts : boundary.inputPorts;
  const match = portList.find((p) => p.contractPortId === port.id);
  if (!match) return null;
  try {
    const t = match.getResolvedType && match.getResolvedType();
    if (t && isConcreteType(t)) return t;
  } catch {}
  return null;
}
