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

  it("double collapse: T(genType) resolves to vec2 when genType is resolved by vec2", () => {
    // T narrows to genType, then a vec2 is wired to the same genType node.
    // T should follow the chain: T → genType → vec2 ⇒ T = vec2
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);

    // Step 1: caller.output[T] → math.inputA[genType] — T narrows to genType
    connect(caller.outputPorts[0], math.inputPorts[0]);
    expect(caller.outputPorts[0].getResolvedType()).toBe("genType");

    // Step 2: vec2.output[vec2] → math.inputB[genType] — genType resolves to vec2
    connect(vec2.outputPorts[0], math.inputPorts[1]);
    expect(math.outputPorts[0].getResolvedType()).toBe("vec2");

    // T should now resolve to vec2 (double collapse)
    expect(caller.outputPorts[0].getResolvedType()).toBe("vec2");
  });

  it("double collapse: vec2 connected directly to T(genType) resolves T to vec2", () => {
    // T is narrowed to genType, then a vec2 is wired directly to T.
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "T" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(fnIn.outputPorts[0], fnOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);

    // Step 1: caller.output[T] → math.input[genType] — T narrows to genType
    connect(caller.outputPorts[0], math.inputPorts[0]);
    expect(caller.outputPorts[0].getResolvedType()).toBe("genType");

    // Step 2: vec2.output[vec2] → caller.input[T] — T should resolve to vec2
    connect(vec2.outputPorts[0], caller.inputPorts[0]);
    expect(caller.inputPorts[0].getResolvedType()).toBe("vec2");
    expect(caller.outputPorts[0].getResolvedType()).toBe("vec2");
  });

  it("double collapse inside function body: FunctionInput T → math genType → vec2", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "T" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);

    // fnIn.output[T] → math.inputA[genType]: T narrows to genType
    connect(fnIn.outputPorts[0], math.inputPorts[0]);
    expect(fnIn.outputPorts[0].getResolvedType()).toBe("genType");

    // vec2.output[vec2] → math.inputB[genType]: genType resolves to vec2
    connect(vec2.outputPorts[0], math.inputPorts[1]);
    expect(math.outputPorts[0].getResolvedType()).toBe("vec2");

    // FunctionInput's T should now resolve to vec2
    expect(fnIn.outputPorts[0].getResolvedType()).toBe("vec2");
  });

  it("T connecting to already-resolved genType(vec2) collapses T to vec2", () => {
    // Reverse order: genType is already resolved to vec2, THEN T connects.
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "T" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);

    // Step 1: vec2 → math.inputA[genType]: genType resolves to vec2
    connect(vec2.outputPorts[0], math.inputPorts[0]);
    expect(math.outputPorts[0].getResolvedType()).toBe("vec2");

    // Step 2: fnIn.output[T] → math.inputB[genType(vec2)]: T should resolve to vec2
    connect(fnIn.outputPorts[0], math.inputPorts[1]);
    expect(fnIn.outputPorts[0].getResolvedType()).toBe("vec2");
  });

  it("reproduces c3sg: caller T with vec2 on both sides and genType body", () => {
    // Function body: FunctionInput[T] → Max[genType] → FunctionOutput[T]
    const g = blueprint.createFunctionGraph({ name: "Function1" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "value", type: "T" }],
      outputs: [{ id: "p_out", name: "result", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    // Wire the body: fnIn[T] → max.A[genType], fnIn[T] → max.B[genType], max.out[genType] → fnOut[T]
    blueprint.setActiveGraph(g.id);
    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const max = blueprint.addNode(0, 0, NODE_TYPES.max);
    connect(fnIn.outputPorts[0], max.inputPorts[0]);
    connect(fnIn.outputPorts[0], max.inputPorts[1]);
    connect(max.outputPorts[0], fnOut.inputPorts[0]);

    // Inside the body, T narrows to genType
    expect(fnIn.outputPorts[0].getResolvedType()).toBe("genType");

    // Main graph: frontUV[vec2] → caller.input[T], caller.output[T] → frontTexture.UV[vec2]
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const frontUV = blueprint.addNode(0, 0, NODE_TYPES.frontUV);
    const frontTexture = blueprint.addNode(0, 0, NODE_TYPES.textureFront);

    // frontUV.output[vec2] → caller.input[T]
    connect(frontUV.outputPorts[0], caller.inputPorts[0]);
    // caller.output[T] → frontTexture.UV[vec2]
    connect(caller.outputPorts[0], frontTexture.inputPorts[0]);

    // T should resolve to vec2 (concrete type from both sides)
    expect(caller.inputPorts[0].getResolvedType()).toBe("vec2");
    expect(caller.outputPorts[0].getResolvedType()).toBe("vec2");
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
