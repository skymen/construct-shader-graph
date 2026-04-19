// HistoryManager unit tests — pure logic with mock blueprint.
// These tests do not depend on the BlueprintSystem and must continue passing
// after the refactor (HistoryManager will be per-graph, taking a Graph instead
// of a BlueprintSystem; the contract is identical).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HistoryManager } from "../HistoryManager.js";

function makeFakeBp(initialState) {
  const bp = {
    _state: structuredClone(initialState),
    exportState() {
      return structuredClone(this._state);
    },
    loadState(s) {
      this._state = structuredClone(s);
    },
    updateUndoRedoButtons: vi.fn(),
  };
  return bp;
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
  let bp, h;

  beforeEach(() => {
    bp = makeFakeBp(emptyState());
    h = new HistoryManager(bp, { changeCoalesceTime: 0 });
    h.pushState("init"); // seeds currentState
  });

  it("initial push seeds currentState without creating an undo entry", () => {
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.currentState).not.toBeNull();
  });

  it("detects added nodes and pushes an undo entry", () => {
    bp._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add node");
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it("undo restores prior state; redo reapplies", () => {
    bp._state.nodes.push({
      id: 1, x: 5, y: 5, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add node");
    expect(bp._state.nodes).toHaveLength(1);

    h.undo();
    expect(bp._state.nodes).toHaveLength(0);
    expect(h.canRedo()).toBe(true);

    h.redo();
    expect(bp._state.nodes).toHaveLength(1);
    expect(bp._state.nodes[0].id).toBe(1);
  });

  it("no-op pushState (state unchanged) does not create an entry", () => {
    h.pushState("noop");
    expect(h.canUndo()).toBe(false);
  });

  it("clear() empties stacks but preserves currentState reference", () => {
    bp._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add");
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it("wireToString produces stable identity used by diff", () => {
    const w = { startNodeId: 1, startPortIndex: 0, endNodeId: 2, endPortIndex: 1, rerouteNodes: [] };
    expect(h.wireToString(w)).toBe("1:0->2:1");
    const w2 = { ...w, rerouteNodes: [{x:1,y:1}, {x:2,y:2}] };
    expect(h.wireToString(w2)).toBe("1:0->2:1:r2");
  });

  it("isApplyingUndoRedo guard prevents recursive pushes during loadState", () => {
    bp._state.nodes.push({
      id: 1, x: 0, y: 0, inputPorts: [], operation: null, customInput: null,
      uniformId: null, data: null,
    });
    h.pushState("add");
    // simulate a buggy loadState that calls pushState during apply
    const loadOrig = bp.loadState.bind(bp);
    bp.loadState = (s) => {
      loadOrig(s);
      h.pushState("inner"); // should be a no-op while undo is in progress
    };
    h.undo();
    expect(h.canRedo()).toBe(true);
    expect(h.undoStack.length).toBe(0);
  });

  it("respects maxUndoSteps", () => {
    h = new HistoryManager(bp, { changeCoalesceTime: 0, maxUndoSteps: 3 });
    h.pushState("seed");
    for (let i = 0; i < 10; i++) {
      bp._state.nodes.push({
        id: i + 100, x: i, y: 0, inputPorts: [],
        operation: null, customInput: null, uniformId: null, data: null,
      });
      h.pushState(`add ${i}`);
    }
    expect(h.undoStack.length).toBe(3);
  });
});
