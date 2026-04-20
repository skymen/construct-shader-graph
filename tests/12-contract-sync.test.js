// Test 12: Contract sync — caller nodes rebuild when contract changes.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function makeFnWithContract(inputs = [], outputs = []) {
  const g = blueprint.createFunctionGraph({ name: "Fn" });
  g.data.contract = { inputs, outputs };
  blueprint.syncContractCallers(g);
  return g;
}

describe("Contract sync", () => {
  describe("caller node created from contract", () => {
    it("has inputs matching contract inputs", () => {
      const g = makeFnWithContract(
        [{ id: 1, name: "a", type: "float" }, { id: 2, name: "b", type: "vec3" }],
        [{ id: 3, name: "out", type: "vec4" }]
      );
      const types = blueprint.getFilteredNodeTypes();
      const [, callerType] = types.find(([k]) => k === `function_call_${g.id}`) || [];
      expect(callerType).toBeDefined();
      expect(callerType.inputs.length).toBe(2);
      expect(callerType.inputs[0].name).toBe("a");
      expect(callerType.inputs[1].name).toBe("b");
    });

    it("has outputs matching contract outputs", () => {
      const g = makeFnWithContract(
        [],
        [{ id: 1, name: "result", type: "float" }]
      );
      const types = blueprint.getFilteredNodeTypes();
      const [, callerType] = types.find(([k]) => k === `function_call_${g.id}`) || [];
      expect(callerType.outputs.length).toBe(1);
      expect(callerType.outputs[0].name).toBe("result");
    });
  });

  describe("contractVersion increments on sync", () => {
    it("increments contractVersion", () => {
      const g = blueprint.createFunctionGraph({ name: "V" });
      const before = g.contractVersion;
      blueprint.syncContractCallers(g);
      expect(g.contractVersion).toBe(before + 1);
    });

    it("increments again on second sync", () => {
      const g = blueprint.createFunctionGraph({ name: "V" });
      blueprint.syncContractCallers(g);
      blueprint.syncContractCallers(g);
      expect(g.contractVersion).toBeGreaterThanOrEqual(2);
    });
  });

  describe("caller nodes in other graphs rebuild", () => {
    it("caller placed in main graph gets rebuilt when contract changes", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "MyFn" });
      fnGraph.data.contract = {
        inputs: [{ id: 1, name: "x", type: "float" }],
        outputs: [{ id: 2, name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Drop a FunctionCall node into main graph
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerNode = blueprint.addNode(0, 0, callerType);

      expect(callerNode.inputPorts.length).toBe(1);
      expect(callerNode.inputPorts[0].name).toBe("x");

      // Now add a second input to the contract
      fnGraph.data.contract.inputs.push({ id: 3, name: "z", type: "vec3" });
      blueprint.syncContractCallers(fnGraph);

      // Caller should now have 2 inputs
      expect(callerNode.inputPorts.length).toBe(2);
      expect(callerNode.inputPorts[1].name).toBe("z");
    });

    it("removing a contract port removes it from the caller", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Shrink" });
      fnGraph.data.contract = {
        inputs: [
          { id: 1, name: "a", type: "float" },
          { id: 2, name: "b", type: "float" },
        ],
        outputs: [{ id: 3, name: "r", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerNode = blueprint.addNode(0, 0, callerType);
      expect(callerNode.inputPorts.length).toBe(2);

      // Remove one input
      fnGraph.data.contract.inputs = [{ id: 1, name: "a", type: "float" }];
      blueprint.syncContractCallers(fnGraph);

      expect(callerNode.inputPorts.length).toBe(1);
      expect(callerNode.inputPorts[0].name).toBe("a");
    });

    it("wires are preserved by contractPortId after reorder", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Reorder" });
      fnGraph.data.contract = {
        inputs: [
          { id: "p1", name: "x", type: "float" },
          { id: "p2", name: "y", type: "float" },
        ],
        outputs: [{ id: "p3", name: "r", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerNode = blueprint.addNode(0, 0, callerType);

      // Wire a float node into port "x" (index 0)
      const floatNode = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
      const srcPort = floatNode.outputPorts[0];
      const dstPort = callerNode.inputPorts[0]; // "x"
      expect(dstPort.contractPortId).toBe("p1");

      // Manually connect (bypass the UI's connectPorts to keep test simple)
      const Wire = globalThis.__sgWire;
      if (Wire) {
        const wire = new Wire(srcPort, dstPort);
        srcPort.connections.push(wire);
        dstPort.connections.push(wire);
        blueprint.wires.push(wire);
      }

      // Reorder inputs in contract
      fnGraph.data.contract.inputs = [
        { id: "p2", name: "y", type: "float" },
        { id: "p1", name: "x", type: "float" },
      ];
      blueprint.syncContractCallers(fnGraph);

      // After reorder, port "x" is now at index 1 — wire should have followed it
      const xPort = callerNode.inputPorts.find((p) => p.contractPortId === "p1");
      expect(xPort).toBeDefined();
      expect(xPort.name).toBe("x");
      if (Wire) {
        expect(xPort.connections.length).toBe(1);
      }
    });
  });

  describe("boundary nodes updated by enforceBoundaryRules", () => {
    it("FunctionInput ports match contract inputs after sync", () => {
      const g = blueprint.createFunctionGraph({ name: "Ports" });
      g.data.contract = {
        inputs: [{ id: 1, name: "speed", type: "float" }],
        outputs: [],
      };
      blueprint.syncContractCallers(g);
      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inputNode.outputPorts.length).toBe(1);
      expect(inputNode.outputPorts[0].name).toBe("speed");
    });
  });
});
