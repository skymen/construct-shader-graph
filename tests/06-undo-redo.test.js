// Real undo/redo round-trip through the BlueprintSystem.
// The unified host-level HistoryManager stores all graphs in one stack.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Undo / Redo", () => {
  it("creating a node via API pushes one undo entry", () => {
    const before = blueprint.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(blueprint.nodes.length).toBe(before + 1);
    expect(blueprint.history.canUndo()).toBe(true);
  });

  it("undo removes the created node; redo brings it back", () => {
    const before = blueprint.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(blueprint.nodes.length).toBe(before + 1);

    blueprint.history.undo();
    expect(blueprint.nodes.length).toBe(before);

    blueprint.history.redo();
    expect(blueprint.nodes.length).toBe(before + 1);
  });

  it("undo of wire creation removes the wire", () => {
    blueprint.createNewFile();
    blueprint.history.clear();
    blueprint.history.initGraphState(blueprint.mainGraphId, blueprint._exportGraphState(blueprint.mainGraph));

    const a = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const b = api.nodes.create({ typeKey: "math", x: 200, y: 0 });

    const beforeWires = blueprint.wires.length;
    api.wires.create({
      from: { nodeId: a.id, kind: "output", index: 0 },
      to: { nodeId: b.id, kind: "input", index: 0 },
    });
    expect(blueprint.wires.length).toBeGreaterThan(beforeWires);

    const afterCreate = blueprint.wires.length;
    blueprint.history.undo();
    expect(blueprint.wires.length).toBeLessThan(afterCreate);
  });

  it("after undo, exportState matches pre-change snapshot", () => {
    const snap = blueprint.exportState();
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    blueprint.history.undo();
    const after = blueprint.exportState();
    expect(after.nodes.length).toBe(snap.nodes.length);
    expect(after.wires.length).toBe(snap.wires.length);
  });
});
