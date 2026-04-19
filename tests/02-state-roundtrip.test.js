// State serialization round-trip contract.
// exportState() -> loadState() -> exportState() must produce equivalent state.
// This is the most important regression test: undo/redo and AI/MCP IR all rely
// on it being faithful.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// Helper: strip volatile or known-divergent fields before comparison.
function normalize(state) {
  // exportState clones via JSON for uniforms/customNodes etc, so deep clone here.
  const clone = JSON.parse(JSON.stringify(state, (k, v) => {
    // Sets aren't serialized by exportState, so we don't expect any here.
    return v;
  }));
  return clone;
}

describe("exportState / loadState round-trip", () => {
  it("empty graph survives a round-trip", () => {
    const before = normalize(blueprint.exportState());
    blueprint.loadState(blueprint.exportState());
    const after = normalize(blueprint.exportState());
    expect(after).toEqual(before);
  });

  it("default graph (FrontUV -> TextureFront -> Output) survives", () => {
    blueprint.addDefaultNodes();
    const before = normalize(blueprint.exportState());
    expect(before.nodes.length).toBeGreaterThan(0);
    expect(before.wires.length).toBeGreaterThan(0);

    blueprint.loadState(blueprint.exportState());
    const after = normalize(blueprint.exportState());
    expect(after).toEqual(before);
  });

  it("preserves node count, wire count, and counters", () => {
    blueprint.addDefaultNodes();
    const before = blueprint.exportState();
    blueprint.loadState(before);
    const after = blueprint.exportState();
    expect(after.nodes.length).toBe(before.nodes.length);
    expect(after.wires.length).toBe(before.wires.length);
    expect(after.counters.nodeIdCounter).toBe(before.counters.nodeIdCounter);
  });

  it("preserves wire endpoint connectivity by node id and port index", () => {
    blueprint.addDefaultNodes();
    const before = blueprint.exportState();
    blueprint.loadState(before);
    const after = blueprint.exportState();
    const beforeKeys = before.wires.map(
      (w) => `${w.startNodeId}:${w.startPortIndex}->${w.endNodeId}:${w.endPortIndex}`,
    ).sort();
    const afterKeys = after.wires.map(
      (w) => `${w.startNodeId}:${w.startPortIndex}->${w.endNodeId}:${w.endPortIndex}`,
    ).sort();
    expect(afterKeys).toEqual(beforeKeys);
  });

  it("loadState reconnects port.connections arrays bidirectionally", () => {
    blueprint.addDefaultNodes();
    const snap = blueprint.exportState();
    blueprint.loadState(snap);
    for (const wire of blueprint.wires) {
      expect(wire.startPort.connections).toContain(wire);
      expect(wire.endPort.connections).toContain(wire);
    }
  });

  it("loadState injects _blueprintSystem on every node", () => {
    blueprint.addDefaultNodes();
    blueprint.loadState(blueprint.exportState());
    for (const node of blueprint.nodes) {
      expect(node._blueprintSystem).toBe(blueprint);
    }
  });
});
