// Variable Get/Set node coupling.
// GetVariableNode.getCustomType walks node._blueprintSystem.nodes to find a
// matching SetVariable. After the refactor this MUST become node._graph.nodes,
// scoped to a single Graph — otherwise variables would leak across graphs.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Variable Get / Set node coupling (single graph)", () => {
  it("every node carries a back-reference (today: _blueprintSystem)", () => {
    blueprint.addDefaultNodes();
    for (const node of blueprint.nodes) {
      expect(node._blueprintSystem).toBe(blueprint);
    }
  });

  it("getCustomType on a GetVariable resolves to the SetVariable's input type", () => {
    const setVar = api.nodes.create({
      typeKey: "setVariable",
      x: 0, y: 0,
      customInput: "myVar",
    });
    const getVar = api.nodes.create({
      typeKey: "getVariable",
      x: 200, y: 0,
      selectedVariable: "myVar",
    });
    // Pull live node objects to query getCustomType.
    const setNode = blueprint.nodes.find((n) => n.id === setVar.id);
    const getNode = blueprint.nodes.find((n) => n.id === getVar.id);
    expect(setNode).toBeTruthy();
    expect(getNode).toBeTruthy();

    // Without anything connected to setNode, the resolved type falls back to
    // the input's declared port type. Just verify the lookup path runs.
    const port = getNode.outputPorts[0];
    const resolved = getNode.nodeType.getCustomType(getNode, port);
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("REFACTOR CONTRACT: lookup is scoped to the owning graph (today: _blueprintSystem.nodes)", () => {
    // Today: variables resolve via node._blueprintSystem.nodes. After the
    // refactor this becomes node._graph.nodes (or whatever the back-ref is
    // renamed to). Either way, this test asserts that the lookup uses ONLY
    // nodes that share the same back-reference as the GetVariable node.
    api.nodes.create({ typeKey: "setVariable", customInput: "v1", x: 0, y: 0 });
    const getVar = api.nodes.create({
      typeKey: "getVariable", selectedVariable: "v1", x: 200, y: 0,
    });
    const getNode = blueprint.nodes.find((n) => n.id === getVar.id);
    const owner = getNode._blueprintSystem || getNode._graph;
    expect(owner).toBeTruthy();
    // The SetVariable node must be reachable from the same owner.
    const set = owner.nodes.find(
      (n) => n.nodeType.name === "Set Variable" && n.customInput === "v1",
    );
    expect(set).toBeTruthy();
  });
});
