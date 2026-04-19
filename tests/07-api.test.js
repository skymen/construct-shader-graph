// Public MCP / console API contract.
// After the refactor, shaderGraphAPI must default to operating on the MAIN
// graph. These tests pin the current single-graph behavior and add explicit
// expectations that creating/deleting/connecting/disconnecting works through
// the API surface, since that is the AI-facing contract.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("api.nodes / api.wires / api.uniforms", () => {
  it("nodes.create returns a node summary with id and typeKey", () => {
    const node = api.nodes.create({ typeKey: "floatInput", x: 100, y: 100 });
    expect(node).toBeTruthy();
    expect(typeof node.id).toBe("number");
    expect(node.typeKey).toBe("floatInput");
  });

  it("nodes.delete removes the node from the graph", () => {
    const node = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const before = blueprint.nodes.length;
    api.nodes.delete(node.id);
    expect(blueprint.nodes.length).toBe(before - 1);
  });

  it("wires.create connects two compatible ports", () => {
    const a = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const b = api.nodes.create({ typeKey: "math", x: 200, y: 0 });
    // floatInput's output (float) -> math's first input (genType, accepts float)
    const result = api.wires.create({
      from: { nodeId: a.id, kind: "output", index: 0 },
      to:   { nodeId: b.id, kind: "input",  index: 0 },
    });
    expect(result).toBeTruthy();
    const wireExists = blueprint.wires.some(
      (w) => w.startPort.node.id === a.id && w.endPort.node.id === b.id,
    );
    expect(wireExists).toBe(true);
  });

  it("uniforms.create adds to blueprint.uniforms", () => {
    const before = blueprint.uniforms.length;
    api.uniforms.create({ name: "myFloat", type: "float" });
    expect(blueprint.uniforms.length).toBe(before + 1);
  });

  it("REFACTOR CONTRACT: api operations apply to the same graph that backs blueprint.nodes", () => {
    // After the refactor, shaderGraphAPI must default to mainGraph; today
    // there's only one graph so this is trivially true. We pin it so the
    // refactor MUST keep this contract: api.nodes.create() result MUST be
    // observable via blueprint (== host.mainGraph).
    const node = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(blueprint.nodes.find((n) => n.id === node.id)).toBeTruthy();
  });
});
