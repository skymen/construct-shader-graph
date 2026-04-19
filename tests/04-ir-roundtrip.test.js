// IR (Intermediate Representation) export/import round-trip.
// IR is the structured format used by the AI/MCP integration. Stable identity
// across export -> import -> export is required.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Graph IR round-trip", () => {
  it("default graph produces a non-empty IR", () => {
    const ir = blueprint.exportGraphIR();
    expect(ir).toBeTruthy();
    expect(Array.isArray(ir.nodes)).toBe(true);
    expect(ir.nodes.length).toBeGreaterThan(0);
  });

  it("import returns ok and reports imported counts", () => {
    // importGraphIR is additive (merges into current graph, reusing the
    // singleton Output node). This characterizes that contract.
    const before = blueprint.exportGraphIR();
    const beforeNodeCount = before.nodes.length;

    blueprint.createNewFile();
    const result = blueprint.importGraphIR(before, { autoLayout: false });
    expect(result).toBeTruthy();
    expect(result.ok).toBe(true);
    expect(result.imported.nodeCount).toBe(beforeNodeCount);
  });

  it("export -> import preserves wire count (additive merge)", () => {
    const ir1 = blueprint.exportGraphIR();
    const wireCount1 = (ir1.wires || []).length;

    blueprint.createNewFile();
    blueprint.importGraphIR(ir1, { autoLayout: false });
    const ir2 = blueprint.exportGraphIR();
    const wireCount2 = (ir2.wires || []).length;

    // Import is additive; original default wires + imported wires.
    // At minimum, ir2 must have >= the imported wire count.
    expect(wireCount2).toBeGreaterThanOrEqual(wireCount1);
  });
});
