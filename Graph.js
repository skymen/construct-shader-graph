// Graph.js
//
// A Graph owns all per-graph editor state: nodes, wires, comments, selection,
// camera, history, uniforms, shader settings, preview pin, and the transient
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
// NODE_TYPES, pressedKeys, autoPanInterval.

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

    // Editable graph data
    this.nodes = [];
    this.wires = [];
    this.comments = [];

    // ID counters (per-graph; ids are NOT globally unique across graphs)
    this.nodeIdCounter = 1;
    this.commentIdCounter = 1;
    this.wireIdCounter = 1;
    this.uniformIdCounter = 1;
    // customNodeIdCounter is host-level (custom node library is shared)

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

    // Uniforms (per-graph)
    this.uniforms = [];
    this.deprecatedUniforms = [];
    this.deprecatedUniformsExpanded = false;

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
}
