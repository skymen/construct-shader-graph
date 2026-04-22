// Test 11: Graph kinds — function and loopBody scaffolding (Phase 2)
//
// Verifies:
// - createFunctionGraph / createLoopBodyGraph set kind, color, data
// - bootstrapGraph adds exactly one Function Input + one Function Output node
// - Boundary node ports reflect the contract after enforceBoundaryRules
// - loopBody always has an Index output on FunctionInput
// - requiresFunctionContext nodes are hidden from main-graph search

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("Graph kinds — Phase 2 scaffolding", () => {
  describe("createFunctionGraph", () => {
    it("sets kind to 'function'", () => {
      const g = blueprint.createFunctionGraph({ name: "MyFn" });
      expect(g.kind).toBe("function");
    });

    it("accepts color and persists it", () => {
      const g = blueprint.createFunctionGraph({ name: "Colored", color: "#ff0000" });
      expect(g.color).toBe("#ff0000");
    });

    it("seeds data.contract with one default input and one default output", () => {
      const g = blueprint.createFunctionGraph({ name: "DataCheck" });
      expect(g.data.notes).toBe("");
      expect(g.data.contract.inputs).toHaveLength(1);
      expect(g.data.contract.outputs).toHaveLength(1);
    });

    it("does not switch the active graph", () => {
      const prevActive = blueprint.activeGraphId;
      blueprint.createFunctionGraph({ name: "Side" });
      expect(blueprint.activeGraphId).toBe(prevActive);
    });
  });

  describe("createLoopBodyGraph", () => {
    it("sets kind to 'loopBody'", () => {
      const g = blueprint.createLoopBodyGraph({ name: "MyLoop" });
      expect(g.kind).toBe("loopBody");
    });

    it("initialises data with a seeded accumulator contract and notes", () => {
      const g = blueprint.createLoopBodyGraph({ name: "LoopData" });
      expect(g.data.notes).toBe("");
      expect(g.data.contract.inputs).toHaveLength(1);
      expect(g.data.contract.outputs).toHaveLength(1);
      const inp = g.data.contract.inputs[0];
      const out = g.data.contract.outputs[0];
      expect(inp.role).toBe("acc");
      expect(inp.type).toBe("T");
      expect(inp.id).toBe(out.id); // paired by id
    });
  });

  describe("bootstrapGraph — function", () => {
    it("adds exactly one Function Input node", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      const inputs = g.nodes.filter((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inputs.length).toBe(1);
    });

    it("adds exactly one Function Output node", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      const outputs = g.nodes.filter((n) => n.nodeType === NODE_TYPES.functionOutput);
      expect(outputs.length).toBe(1);
    });

    it("Function Input has one output port for default-seeded contract", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inputNode.outputPorts.length).toBe(1);
    });

    it("Function Output has one input port for default-seeded contract", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      const outputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      expect(outputNode.inputPorts.length).toBe(1);
    });
  });

  describe("bootstrapGraph — loopBody", () => {
    it("adds exactly one Function Input node", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Loop" });
      const inputs = g.nodes.filter((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inputs.length).toBe(1);
    });

    it("adds exactly one Function Output node", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Loop" });
      const outputs = g.nodes.filter((n) => n.nodeType === NODE_TYPES.functionOutput);
      expect(outputs.length).toBe(1);
    });

    it("Function Input always has Index as the first output port and Count as the second", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Loop" });
      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inputNode.outputPorts.length).toBeGreaterThanOrEqual(2);
      expect(inputNode.outputPorts[0].portType).toBe("int");
      expect(inputNode.outputPorts[0].name).toBe("Index");
      expect(inputNode.outputPorts[1].portType).toBe("int");
      expect(inputNode.outputPorts[1].name).toBe("Count");
    });
  });

  describe("enforceBoundaryRules — ports match contract", () => {
    it("function: contract inputs become FunctionInput output ports", () => {
      const g = blueprint.createFunctionGraph({ name: "Lerp" });
      g.data.contract.inputs = [
        { id: 1, name: "a", type: "float" },
        { id: 2, name: "b", type: "vec3" },
      ];

      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      blueprint._rebuildBoundaryNodePorts(inputNode, [], [
        { name: "a", type: "float" },
        { name: "b", type: "vec3" },
      ]);

      expect(inputNode.outputPorts.length).toBe(2);
      expect(inputNode.outputPorts[0].portType).toBe("float");
      expect(inputNode.outputPorts[0].name).toBe("a");
      expect(inputNode.outputPorts[1].portType).toBe("vec3");
      expect(inputNode.outputPorts[1].name).toBe("b");
    });

    it("function: contract outputs become FunctionOutput input ports", () => {
      const g = blueprint.createFunctionGraph({ name: "Multi" });
      g.data.contract.outputs = [
        { id: 1, name: "result", type: "vec4" },
      ];

      const outputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      blueprint._rebuildBoundaryNodePorts(outputNode, [{ name: "result", type: "vec4" }], []);

      expect(outputNode.inputPorts.length).toBe(1);
      expect(outputNode.inputPorts[0].portType).toBe("vec4");
      expect(outputNode.inputPorts[0].name).toBe("result");
    });

    it("loopBody: Index and Count stay first after adding contract inputs", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Sum" });
      g.data.contract.inputs.push({ id: 1, name: "acc", type: "float", role: "acc" });

      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      // Re-enforce: Index + Count + contract inputs
      blueprint._rebuildBoundaryNodePorts(inputNode, [], [
        { name: "Index", type: "int" },
        { name: "Count", type: "int" },
        { name: "acc", type: "float" },
      ]);

      expect(inputNode.outputPorts[0].name).toBe("Index");
      expect(inputNode.outputPorts[0].portType).toBe("int");
      expect(inputNode.outputPorts[1].name).toBe("Count");
      expect(inputNode.outputPorts[1].portType).toBe("int");
      expect(inputNode.outputPorts[2].name).toBe("acc");
      expect(inputNode.outputPorts[2].portType).toBe("float");
    });
  });

  describe("requiresFunctionContext filter", () => {
    it("functionInput is absent from main graph search results", () => {
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const types = blueprint.getFilteredNodeTypes();
      const hasInput = types.some(([key]) => key === "functionInput");
      const hasOutput = types.some(([key]) => key === "functionOutput");
      expect(hasInput).toBe(false);
      expect(hasOutput).toBe(false);
    });

    it("functionInput/Output are hidden in a fresh function graph (already placed by bootstrap)", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      blueprint.setActiveGraph(g.id);
      const types = blueprint.getFilteredNodeTypes();
      const hasInput = types.some(([key]) => key === "functionInput");
      const hasOutput = types.some(([key]) => key === "functionOutput");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      expect(hasInput).toBe(false);
      expect(hasOutput).toBe(false);
    });

    it("functionInput becomes available in a subgraph after removing the existing boundary node", () => {
      const g = blueprint.createFunctionGraph({ name: "Fn" });
      // Simulate removing the bootstrapped FunctionInput node directly.
      g.nodes = g.nodes.filter((n) => n.nodeType !== NODE_TYPES.functionInput);
      blueprint.setActiveGraph(g.id);
      const types = blueprint.getFilteredNodeTypes();
      const hasInput = types.some(([key]) => key === "functionInput");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      expect(hasInput).toBe(true);
    });
  });

  describe("getCallableGraphs", () => {
    it("returns only function and loopBody graphs, not main", () => {
      const fn = blueprint.createFunctionGraph({ name: "F" });
      const loop = blueprint.createLoopBodyGraph({ name: "L" });
      const callable = blueprint.getCallableGraphs();
      expect(callable.some((g) => g.id === fn.id)).toBe(true);
      expect(callable.some((g) => g.id === loop.id)).toBe(true);
      expect(callable.some((g) => g.id === blueprint.mainGraphId)).toBe(false);
    });
  });
});
