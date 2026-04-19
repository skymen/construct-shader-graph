// Selection invariants and delete-selected behavior.
// After the refactor, selection lives on the active Graph. Operations on the
// active graph must NOT touch other graphs' selections.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Selection", () => {
  it("selectAllNodes selects every node", () => {
    const total = blueprint.nodes.length;
    blueprint.selectAllNodes();
    expect(blueprint.selectedNodes.size).toBe(total);
  });

  it("clearSelection empties selectedNodes and reroute selection", () => {
    blueprint.selectAllNodes();
    expect(blueprint.selectedNodes.size).toBeGreaterThan(0);
    blueprint.clearSelection();
    expect(blueprint.selectedNodes.size).toBe(0);
    expect(blueprint.selectedRerouteNodes.size).toBe(0);
  });

  it("selectNode adds a node to selection", () => {
    blueprint.clearSelection();
    const n = blueprint.nodes[0];
    blueprint.selectNode(n, false);
    expect(blueprint.selectedNodes.has(n)).toBe(true);
  });

  it("deleteSelected removes selected nodes and their wires", () => {
    blueprint.clearSelection();
    const before = blueprint.nodes.length;
    const target = blueprint.nodes[0];
    blueprint.selectNode(target, false);
    blueprint.deleteSelected();
    expect(blueprint.nodes.length).toBe(before - 1);
    // No remaining wire should reference the deleted node.
    for (const w of blueprint.wires) {
      expect(w.startPort.node).not.toBe(target);
      expect(w.endPort.node).not.toBe(target);
    }
  });
});
