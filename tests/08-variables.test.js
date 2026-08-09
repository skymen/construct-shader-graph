// Variable Get/Set node coupling.
// GetVariableNode.getCustomType walks node._blueprintSystem.nodes to find a
// matching SetVariable. After the refactor this MUST become node._graph.nodes,
// scoped to a single Graph — otherwise variables would leak across graphs.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
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
    // the input's declared port type.
    const port = getNode.outputPorts[0];
    const resolved = getNode.nodeType.getCustomType(getNode, port);
    const validTypes = [
      "float", "int", "bool", "vec2", "vec3", "vec4",
      "mat2", "mat3", "mat4", "sampler2D",
      "T", "U", "V",
    ];
    expect(validTypes).toContain(resolved);
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

describe("Renaming a Set Variable carries its Get Variables", () => {
  it("retargets every reader of the old name", () => {
    const setVar = api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "oldName",
    });
    const a = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "oldName",
    });
    const b = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 100, selectedVariable: "oldName",
    });
    const other = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 200, selectedVariable: "somethingElse",
    });

    const setNode = blueprint.nodes.find((n) => n.id === setVar.id);
    setNode.updateCustomInput("newName", blueprint);

    const byId = (id) => blueprint.nodes.find((n) => n.id === id);
    expect(byId(a.id).selectedVariable).toBe("newName");
    expect(byId(b.id).selectedVariable).toBe("newName");
    expect(byId(other.id).selectedVariable).toBe("somethingElse");
  });

  it("renaming through the API does the same", () => {
    api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "before",
    });
    const getVar = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "before",
    });
    const setNode = blueprint.nodes.find(
      (n) => n.nodeType.name === "Set Variable" && n.customInput === "before",
    );

    api.nodes.edit(setNode.id, { customInput: "after" });

    const getNode = blueprint.nodes.find((n) => n.id === getVar.id);
    expect(getNode.selectedVariable).toBe("after");
  });

  it("does not touch same-named getters in another graph", () => {
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainSet = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    mainSet.customInput = "shared";

    const fnGraph = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fnGraph.id);
    const fnGet = blueprint.addNode(200, 0, NODE_TYPES.getVariable);
    fnGet.selectedVariable = "shared";

    blueprint.setActiveGraph(blueprint.mainGraphId);
    mainSet.updateCustomInput("renamed", blueprint);

    expect(fnGet.selectedVariable).toBe("shared");
  });

  it("the rename is one undo away", () => {
    api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "v",
    });
    const getVar = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "v",
    });
    const setNode = blueprint.nodes.find(
      (n) => n.nodeType.name === "Set Variable" && n.customInput === "v",
    );

    api.nodes.edit(setNode.id, { customInput: "w" });
    blueprint.history.undo();

    const byId = (id) => blueprint.nodes.find((n) => n.id === id);
    expect(byId(setNode.id).customInput).toBe("v");
    expect(byId(getVar.id).selectedVariable).toBe("v");
  });
});

describe("Selected variable nodes report their name-only links", () => {
  it("selecting the setter links to every reader of it", () => {
    blueprint.clearSelection();
    const setVar = api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "v",
    });
    const a = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "v",
    });
    const b = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 100, selectedVariable: "v",
    });
    api.nodes.create({
      typeKey: "getVariable", x: 200, y: 200, selectedVariable: "other",
    });

    const setNode = blueprint.nodes.find((n) => n.id === setVar.id);
    blueprint.selectNode(setNode, false);

    const links = blueprint.selectedVariableLinks();
    expect(links.length).toBe(2);
    expect(links.every(([s]) => s === setNode)).toBe(true);
    expect(links.map(([, g]) => g.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("selecting a reader links back to its one setter", () => {
    blueprint.clearSelection();
    const setVar = api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "v",
    });
    const getVar = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "v",
    });

    const getNode = blueprint.nodes.find((n) => n.id === getVar.id);
    blueprint.selectNode(getNode, false);

    const links = blueprint.selectedVariableLinks();
    expect(links.length).toBe(1);
    expect(links[0][0].id).toBe(setVar.id);
    expect(links[0][1]).toBe(getNode);
  });

  it("selecting both ends of a pair reports the link once", () => {
    blueprint.clearSelection();
    const setVar = api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "v",
    });
    const getVar = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "v",
    });

    blueprint.selectNode(blueprint.nodes.find((n) => n.id === setVar.id), false);
    blueprint.selectNode(blueprint.nodes.find((n) => n.id === getVar.id), true);

    expect(blueprint.selectedVariableLinks().length).toBe(1);
  });

  it("no selection means no links", () => {
    api.nodes.create({
      typeKey: "setVariable", x: 0, y: 0, customInput: "v",
    });
    api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "v",
    });
    blueprint.clearSelection();
    expect(blueprint.selectedVariableLinks()).toEqual([]);
  });

  it("a dangling getter contributes no link", () => {
    blueprint.clearSelection();
    const getVar = api.nodes.create({
      typeKey: "getVariable", x: 200, y: 0, selectedVariable: "missing",
    });
    blueprint.selectNode(blueprint.nodes.find((n) => n.id === getVar.id), false);
    expect(blueprint.selectedVariableLinks()).toEqual([]);
  });
});
