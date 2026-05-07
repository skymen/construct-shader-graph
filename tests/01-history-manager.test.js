// HistoryManager unit tests — pure logic with mock host.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HistoryManager } from "../HistoryManager.js";

function makeFakeHost(initialState) {
  const graphId = "test_graph";
  const graph = {
    id: graphId,
    kind: "main",
    _state: structuredClone(initialState),
  };
  const host = {
    graphs: new Map([[graphId, graph]]),
    activeGraphId: graphId,
    get activeGraph() { return this.graphs.get(this.activeGraphId); },
    _exportGraphState(g) { return structuredClone(g._state); },
    _loadGraphState(g, s) { g._state = structuredClone(s); },
    updateUndoRedoButtons: vi.fn(),
    setActiveGraph(id) { this.activeGraphId = id; },
  };
  return { host, graph };
}

const emptyState = () => ({
  nodes: [],
  wires: [],
  comments: [],
  uniforms: [],
  customNodes: [],
  shaderSettings: {},
});

describe("HistoryManager", () => {
  let host, graph, h;

  beforeEach(() => {
    ({ host, graph } = makeFakeHost(emptyState()));
    h = new HistoryManager(host, { changeCoalesceTime: 0 });
    h.initGraphState(graph.id, structuredClone(graph._state));
  });

  it("initGraphState seeds currentState without creating an undo entry", () => {
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.currentStates.get(graph.id)).not.toBeNull();
  });

  it("detects added nodes and pushes an undo entry", () => {
    graph._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add node");
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it("undo restores prior state; redo reapplies", () => {
    graph._state.nodes.push({
      id: 1, x: 5, y: 5, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add node");
    expect(graph._state.nodes).toHaveLength(1);

    h.undo();
    expect(graph._state.nodes).toHaveLength(0);
    expect(h.canRedo()).toBe(true);

    h.redo();
    expect(graph._state.nodes).toHaveLength(1);
    expect(graph._state.nodes[0].id).toBe(1);
  });

  it("no-op pushState (state unchanged) does not create an entry", () => {
    h.pushState("noop");
    expect(h.canUndo()).toBe(false);
  });

  it("clear() empties stacks and currentStates", () => {
    graph._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add");
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.currentStates.size).toBe(0);
  });

  it("wireToString produces stable identity used by diff", () => {
    const w = { startNodeId: 1, startPortIndex: 0, endNodeId: 2, endPortIndex: 1, rerouteNodes: [] };
    expect(h.wireToString(w)).toBe("1:0->2:1");
    const w2 = { ...w, rerouteNodes: [{x:1,y:1}, {x:2,y:2}] };
    expect(h.wireToString(w2)).toBe("1:0->2:1:r2");
  });

  it("isApplyingUndoRedo guard prevents recursive pushes during loadState", () => {
    graph._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add");
    const loadOrig = host._loadGraphState.bind(host);
    host._loadGraphState = (g, s) => {
      loadOrig(g, s);
      h.pushState("inner");
    };
    h.undo();
    expect(h.canRedo()).toBe(true);
    expect(h.undoStack.length).toBe(0);
  });

  it("respects maxUndoSteps", () => {
    h = new HistoryManager(host, { changeCoalesceTime: 0, maxUndoSteps: 3 });
    h.initGraphState(graph.id, structuredClone(graph._state));
    for (let i = 0; i < 10; i++) {
      graph._state.nodes.push({
        id: i + 100, x: i, y: 0, inputPorts: [],
        operation: null, customInput: null, uniformId: null, data: null,
      });
      h.pushState(`add ${i}`);
    }
    expect(h.undoStack.length).toBe(3);
  });

  it("undo/redo switches active graph to the entry's primary graph", () => {
    graph._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add");

    // Simulate switching to a different graph
    const graph2 = { id: "other", kind: "function", _state: structuredClone(emptyState()) };
    host.graphs.set(graph2.id, graph2);
    host.activeGraphId = graph2.id;

    // Undo should switch back to the original graph
    h.undo();
    expect(host.activeGraphId).toBe(graph.id);
  });
});
