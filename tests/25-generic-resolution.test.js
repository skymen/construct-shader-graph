// Test 25: Generic-to-generic resolution.
// When a wider generic (T) connects to a narrower generic (genType),
// the wider one resolves to the narrower generic type.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { isGenericType } from "../nodes/PortTypes.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
  blueprint.nodes = [];
  blueprint.wires = [];
});

function connect(srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  blueprint.resolveGenericsForConnection(srcPort, dstPort);
  return wire;
}

function disconnect(wire) {
  blueprint.disconnectWire(wire);
}

function addCaller(target) {
  const key = `function_call_${target.id}`;
  const callerType = blueprint.getCallableFunctionNodeTypes()[key];
  if (!callerType) throw new Error(`no caller type for ${target.name}`);
  return blueprint.addNode(0, 0, callerType);
}

describe("generic-to-generic resolution", () => {
  it("T resolves to genType when connected to a genType node", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);

    // caller.output is T, math.input is genType
    connect(caller.outputPorts[0], math.inputPorts[0]);

    // T should resolve to genType (narrower generic)
    expect(caller.outputPorts[0].getResolvedType()).toBe("genType");
  });

  it("concrete type overrides a generic-narrowed resolution", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "T" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    // Wire the body so T flows through
    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(fnIn.outputPorts[0], fnOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);

    // First connect caller.output[T] → math.input[genType]: T narrows to genType
    connect(caller.outputPorts[0], math.inputPorts[0]);
    expect(caller.outputPorts[0].getResolvedType()).toBe("genType");

    // Now connect a concrete float to the caller's T input — should override to float
    const floatNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    connect(floatNode.outputPorts[0], caller.inputPorts[0]);

    expect(caller.inputPorts[0].getResolvedType()).toBe("float");
    // The output T should now resolve to float (concrete overrides generic narrowing)
    expect(caller.outputPorts[0].getResolvedType()).toBe("float");
  });

  it("re-evaluation after concrete wire drop preserves generic narrowing", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "T" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    // Wire the body so T flows through
    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(fnIn.outputPorts[0], fnOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);

    // Connect caller.output[T] → math.input[genType]: T narrows to genType
    connect(caller.outputPorts[0], math.inputPorts[0]);
    expect(caller.outputPorts[0].getResolvedType()).toBe("genType");

    // Connect a concrete float to caller input, making T resolve to float
    const floatNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const concreteWire = connect(floatNode.outputPorts[0], caller.inputPorts[0]);
    expect(caller.outputPorts[0].getResolvedType()).toBe("float");

    // Drop the concrete wire — T should go back to genType (from the genType connection)
    disconnect(concreteWire);

    const resolvedType = caller.outputPorts[0].getResolvedType();
    expect(resolvedType).toBe("genType");
  });

  it("genType does not resolve to T (wider generic does not narrow to wider)", () => {
    // When genType connects to T, genType should NOT resolve to T since T is wider
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "genType" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);

    // Create a second function with T input
    const g2 = blueprint.createFunctionGraph({ name: "Fn2" });
    g2.data.contract = {
      inputs: [{ id: "q_in", name: "x", type: "T" }],
      outputs: [{ id: "q_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g2);
    const caller2 = addCaller(g2);

    // caller.output[genType] → caller2.input[T]
    connect(caller.outputPorts[0], caller2.inputPorts[0]);

    // genType should stay unresolved (T is wider, not narrower)
    const resolvedGenType = caller.outputPorts[0].getResolvedType();
    expect(resolvedGenType === null || resolvedGenType === undefined || resolvedGenType === "genType").toBe(true);

    // T should resolve to genType (narrowed by the genType connection)
    expect(caller2.inputPorts[0].getResolvedType()).toBe("genType");
  });
});
