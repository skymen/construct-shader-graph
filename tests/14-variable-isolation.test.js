// Test 14: Variable isolation — Set/Get Variable in a function graph
// must be independent from same-named variables in the main graph.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Variable isolation across graphs", () => {
  it("SetVariable in main does not appear in function graph's nodes", () => {
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const setNode = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    setNode.customInput = "myVar";

    const fnGraph = blueprint.createFunctionGraph({ name: "Fn" });
    // Main's setVariable should not be in fnGraph.nodes
    expect(fnGraph.nodes).not.toContain(setNode);
  });

  it("GetVariable in function graph resolves only against function graph nodes", () => {
    // Add SetVariable "shared" to main
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainSet = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    mainSet.customInput = "shared";

    // Create a function graph; add GetVariable "shared" there
    const fnGraph = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fnGraph.id);
    const getNode = blueprint.addNode(0, 0, NODE_TYPES.getVariable);
    getNode.selectedVariable = "shared";

    // The GetVariable node's owner is fnGraph; fnGraph has no SetVariable for "shared"
    const ownerGraph = getNode._graph || fnGraph;
    const matchingSet = ownerGraph.nodes.find(
      (n) => n.nodeType.name === "Set Variable" && n.customInput === "shared"
    );
    expect(matchingSet).toBeUndefined();

    blueprint.setActiveGraph(blueprint.mainGraphId);
  });

  it("SetVariable added to function graph is not visible in main graph", () => {
    const fnGraph = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fnGraph.id);
    const fnSet = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    fnSet.customInput = "fnVar";

    blueprint.setActiveGraph(blueprint.mainGraphId);

    // Main graph nodes should not contain fnSet
    expect(blueprint.mainGraph.nodes).not.toContain(fnSet);
  });

  it("same variable name in main and function are independent objects", () => {
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainSet = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    mainSet.customInput = "x";

    const fnGraph = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fnGraph.id);
    const fnSet = blueprint.addNode(0, 0, NODE_TYPES.setVariable);
    fnSet.customInput = "x";

    // They are different node objects
    expect(mainSet).not.toBe(fnSet);
    // Each lives only in its own graph
    expect(blueprint.mainGraph.nodes).toContain(mainSet);
    expect(blueprint.mainGraph.nodes).not.toContain(fnSet);
    expect(fnGraph.nodes).toContain(fnSet);
    expect(fnGraph.nodes).not.toContain(mainSet);

    blueprint.setActiveGraph(blueprint.mainGraphId);
  });
});
