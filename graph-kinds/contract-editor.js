// graph-kinds/contract-editor.js
//
// The sidebar that edits a subgraph's contract: the info form, the two port
// lists, and the row widget with its drag-to-reorder.
//
// There used to be one of these per graph kind, ~95% identical, and they
// drifted: the generic-type dropdown was upgraded in the function copy and left
// alone in the loop-body copy, which is how `genType` came to be treated as a
// concrete type in loop bodies. Now that both kinds share one type vocabulary
// and neither has a role selector, there is nothing left to specialise — the
// only per-kind difference is what the two sections are called.

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";
import {
  CONCRETE_TYPE_OPTIONS,
  GENERIC_TYPE_OPTIONS,
  isConcreteType,
} from "./contract.js";

// What a handler may set to name its sections. Both kinds store the same two
// arrays; only the words differ.
export const DEFAULT_SECTION_LABELS = {
  inputs: "Inputs",
  outputs: "Outputs",
  addInput: "+ Add Input",
  addOutput: "+ Add Output",
};

export function renderContractEditor(handler, graph, host, container) {
  const { infoForm, inputsList, outputsList } = container;
  applySectionLabels(handler);
  renderInfoForm(handler, graph, host, infoForm);
  renderPortList(handler, graph, host, inputsList, "inputs");
  renderPortList(handler, graph, host, outputsList, "outputs");
}

// The section headings and add-button captions live in index.html as static
// text, so they get retitled per kind here rather than rebuilt.
function applySectionLabels(handler) {
  const labels = {
    ...DEFAULT_SECTION_LABELS,
    ...(handler.sectionLabels || {}),
  };
  const set = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  };
  set("#function-inputs-section .sidebar-section-header h2", labels.inputs);
  set("#function-outputs-section .sidebar-section-header h2", labels.outputs);
  set("#addContractInputBtn", labels.addInput);
  set("#addContractOutputBtn", labels.addOutput);
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

  // Anything only one kind needs. Name, colour and notes are common to both, so
  // they stay above rather than being duplicated per handler.
  handler.renderExtraInfoRows?.(graph, host, form);
}

export function buildLabeledRow(labelText, control) {
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
  // Read only. This used to lazily assign `contract[which] = []`, so merely
  // opening the sidebar wrote empty arrays onto the graph, which then got
  // serialized and snapshotted into history.
  const ports = graph.data?.contract?.[which] || [];
  ports.forEach((port, index) => {
    listEl.appendChild(buildPortRow(handler, graph, host, port, index, which));
  });
}

// Everything a contract edit has to touch: callers in every graph, the sidebar
// itself, the functions list, the canvas, and codegen.
function refresh(host, graph) {
  host.syncContractCallers(graph);
  host.renderContractEditor && host.renderContractEditor();
  host.renderFunctionsList && host.renderFunctionsList();
  host.render && host.render();
  host.onShaderChanged && host.onShaderChanged();
}

// Would `apply` introduce a validation error the contract doesn't already have?
//
// Running the handler's real validator, rather than a second hand-written rule,
// is what stops the editor and codegen disagreeing about what a legal name is —
// the editor used to allow a function input and output to share a name that
// validateContract then rejected, so you found out at codegen time.
function introducesError(handler, contract, apply) {
  const before = new Set(handler.validateContract(contract));
  const trial = JSON.parse(JSON.stringify(contract));
  apply(trial);
  return handler.validateContract(trial).some((e) => !before.has(e));
}

function buildPortRow(handler, graph, host, port, index, which) {
  const contract = graph.data.contract;

  const row = document.createElement("div");
  row.className = "contract-port-row";
  row.draggable = true;
  row.dataset.index = String(index);
  row.dataset.which = which;

  // Drag handle
  const handle = document.createElement("div");
  handle.className = "contract-port-drag-handle";
  handle.textContent = "⋮⋮";
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
    if (introducesError(handler, contract, (t) => (t[which][index].name = v))) {
      nameInput.value = port.name || "";
      return;
    }
    port.name = v;
    refresh(host, graph);
  });
  row.appendChild(nameInput);

  // Type select — concrete and generic in one dropdown
  const typeSelect = document.createElement("select");
  typeSelect.className = "contract-port-type";

  const concreteGroup = document.createElement("optgroup");
  concreteGroup.label = "Concrete";
  for (const opt of CONCRETE_TYPE_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    concreteGroup.appendChild(o);
  }
  typeSelect.appendChild(concreteGroup);

  const genericGroup = document.createElement("optgroup");
  genericGroup.label = "Generic";
  for (const opt of GENERIC_TYPE_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    genericGroup.appendChild(o);
  }
  typeSelect.appendChild(genericGroup);

  typeSelect.value = port.type;

  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === port.type) return;
    port.type = typeSelect.value;
    refresh(host, graph);
  });
  row.appendChild(typeSelect);

  // What a generic port actually resolved to, if the body pins it down.
  if (!isConcreteType(port.type)) {
    const resolved = resolveGenericType(graph, port, which);
    if (resolved && resolved !== port.type) {
      const hint = document.createElement("span");
      hint.className = "contract-port-resolved-hint";
      hint.textContent = `→ ${resolved}`;
      row.appendChild(hint);
    }
  }

  // Delete
  const del = document.createElement("button");
  del.type = "button";
  del.className = "contract-port-delete";
  del.textContent = "×";
  del.title = "Remove port";
  del.addEventListener("click", () => {
    contract[which].splice(index, 1);
    refresh(host, graph);
  });
  row.appendChild(del);

  // Drag-reorder — only when grabbed by the handle.
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
    const arr = contract[which];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    refresh(host, graph);
  });

  return row;
}

// For a generic contract port, read the type the body actually pinned it to.
// Contract inputs map to the FunctionInput node's *output* ports, contract
// outputs to the FunctionOutput node's *input* ports — true for both kinds,
// since a loop body's injected Index/Count carry their own contractPortIds and
// so never match a contract port.
function resolveGenericType(graph, port, which) {
  const nodes = graph.nodes || [];
  const boundary =
    which === "inputs"
      ? nodes.find((n) => n.nodeType === FunctionInputNode)
      : nodes.find((n) => n.nodeType === FunctionOutputNode);
  if (!boundary) return null;
  const portList =
    which === "inputs" ? boundary.outputPorts : boundary.inputPorts;
  const match = portList.find((p) => p.contractPortId === port.id);
  if (!match) return null;
  const t = match.getResolvedType();
  if (t && isConcreteType(t)) return t;
  return null;
}
