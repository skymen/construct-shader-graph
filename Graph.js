// Graph.js
//
// A Graph owns all per-graph editor state: nodes, wires, comments, selection,
// camera, history, shader settings, preview pin, and the transient
// interaction state machine. The BlueprintSystem (host) owns one or more
// Graphs and delegates per-graph reads/writes to the active graph through
// property getters/setters defined on the host instance.
//
// Two distinguished graphs:
//   mainGraph:    always used for code generation and preview, even if not
//                 active. Cannot be deleted.
//   activeGraph:  the graph the UI displays and the user interacts with.
//
// Things that are NOT per-graph (live on host): canvas/DOM, customNodes
// library, clipboard, preview iframe + previewSettings, mcpBridge,
// NODE_TYPES, pressedKeys, autoPanInterval, uniforms.

import { HistoryManager } from "./HistoryManager.js";

let __graphIdCounter = 1;

export function makeDefaultShaderSettings() {
  return {
    name: "",
    version: "0.0.0.0",
    author: "",
    website: "",
    documentation: "",
    description: "",
    category: "color",
    blendsBackground: false,
    crossSampling: false,
    preservesOpaqueness: true,
    animated: false,
    isDeprecated: false,
    usesDepth: false,
    mustPredraw: false,
    supports3DDirectRendering: false,
    extendBoxH: 0,
    extendBoxV: 0,
  };
}

export class Graph {
  constructor(host, opts = {}) {
    this.host = host;
    this.id = opts.id || `g_${__graphIdCounter++}`;
    this.name = opts.name || "Untitled";

    // Graph kind: 'main' | 'function' | 'loopBody'
    this.kind = opts.kind || "main";
    // Optional color tint for sidebar/tab display
    this.color = opts.color || null;
    // Per-kind freeform data bag (e.g., contract for function/loopBody kinds)
    this.data = opts.data || {};
    // Increments on any contract edit; used by callers to detect drift
    this.contractVersion = opts.contractVersion || 0;

    // Editable graph data
    this.nodes = [];
    this.wires = [];
    this.comments = [];

    // ID counters (per-graph; ids are NOT globally unique across graphs)
    this.nodeIdCounter = 1;
    this.commentIdCounter = 1;
    this.wireIdCounter = 1;
    // customNodeIdCounter and uniformIdCounter are host-level (shared)

    // Selection
    this.selectedNodes = new Set();
    this.selectedRerouteNodes = new Set();
    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.boxSelectEnd = null;
    this.boxSelectInitialNodes = new Set();
    this.boxSelectInitialRerouteNodes = new Set();

    // Transient interaction state
    this.draggedNode = null;
    this.activeWire = null;
    this.hoveredPort = null;
    this.draggedRerouteNode = null;
    this.draggedComment = null;
    this.resizingComment = null;
    this.lastClickTime = 0;
    this.lastClickPos = { x: 0, y: 0 };
    this.editingPort = null;
    this.editingCustomEditor = null;
    this.pendingCustomEditorClick = null;
    this.highlightedWire = null;
    this.dragStartPositions = new Map();

    // Camera (per-graph; each graph remembers its own pan/zoom)
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // File handle (per-graph; not yet used for non-main graphs)
    this.fileHandle = null;

    // Shader settings (per-graph; each graph is its own shader)
    this.shaderSettings = makeDefaultShaderSettings();

    // Preview pin (only mainGraph's previewNode drives codegen + preview)
    this.previewNode = null;
    this.previewAnimationTime = 0;

    // Per-graph undo/redo history
    this.history = new HistoryManager(this);
  }

  isActive() {
    return !!this.host && this.host.activeGraphId === this.id;
  }

  isMain() {
    return !!this.host && this.host.mainGraphId === this.id;
  }

  // ---- HistoryManager target interface ----
  // HistoryManager calls graph.exportState() / graph.loadState(state) /
  // graph.updateUndoRedoButtons(). Implementation is delegated to the host
  // because the snapshot logic depends on host helpers (cloneValue,
  // getNodeTypeKey, etc.) and the load logic must touch UI/preview when this
  // graph is the active or main graph.
  exportState() {
    return this.host._exportGraphState(this);
  }

  loadState(stateData) {
    return this.host._loadGraphState(this, stateData);
  }

  updateUndoRedoButtons() {
    // Only the active graph's undo/redo state is reflected in the toolbar.
    if (this.isActive()) {
      this.host.updateUndoRedoButtons();
    }
  }

  // Select every node in this graph. Mirrors the host method but always
  // operates on this graph's own nodes/selection so callers can target a
  // non-active graph explicitly.
  selectAllNodes() {
    this.nodes.forEach((node) => {
      node.isSelected = true;
      this.selectedNodes.add(node);
    });
    if (this.isActive() && this.host && typeof this.host.render === "function") {
      this.host.render();
    }
  }
}
