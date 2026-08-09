// Test 21: Golden-file codegen
//
// Strict byte-for-byte comparison of generated shader source against fixture
// files under tests/golden/. Unlike tests 05/15/20 which use fuzzy matchers
// (toContain / toMatch), this suite catches regressions in formatting,
// whitespace, variable-name counters, declaration ordering, and boilerplate.
//
// Workflow:
//   - To populate / refresh fixtures:  UPDATE_GOLDEN=1 npx vitest run tests/21-golden-codegen.test.js
//   - Normal runs compare strictly and fail on any drift.
//
// Determinism notes:
//   - Graphs use explicit IDs via `createGraph({ id, ... })` so mangled function
//     names (fn_<graphId>) stay stable across runs despite the module-level
//     __graphIdCounter.
//   - Nodes are added in a fixed order so per-graph nodeIdCounter stays stable.
//   - mkId for contract port IDs uses Date.now() + Math.random(), but those IDs
//     are internal (contractPortId) and do NOT appear in generated shader code.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { compareGolden } from "./helpers/golden.js";

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
  if (!Wire) throw new Error("Wire not exposed on globalThis.__sgWire");
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  // Mirror the UI wire-creation path: resolve generics on the two endpoints so
  // `getResolvedType()` returns the concrete type instead of the generic letter.
  blueprint.resolveGenericsForConnection(srcPort, dstPort);
  return wire;
}

// Build a minimal concrete pass-through: Input.x:float → Math(+1) → Output.r:float.
// Takes an explicit graph id so the emitted `fn_<id>` name is stable.
function buildPassthroughFloat(id, name) {
  const g = blueprint.createFunctionGraph({ id, name });
  g.data.contract = {
    inputs: [{ id: `${id}_in`, name: "x", type: "float" }],
    outputs: [{ id: `${id}_out`, name: "r", type: "float" }],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  const math = blueprint.addNode(0, 0, NODE_TYPES.math);
  connect(inp.outputPorts[0], math.inputPorts[0]);
  connect(math.outputPorts[0], outp.inputPorts[0]);
  return g;
}

function addCaller(target) {
  const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${target.id}`];
  if (!callerType) throw new Error(`no caller type for ${target.name}`);
  return blueprint.addNode(0, 0, callerType);
}

describe("Golden-file codegen", () => {
  it("minimal-output: bare Output node emits valid shader for all targets", () => {
    const out = blueprint.addNode(0, 0, NODE_TYPES.output);
    const vec4 = blueprint.addNode(0, 0, NODE_TYPES.vec4);
    connect(vec4.outputPorts[0], out.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    expect(shaders).not.toBeNull();
    compareGolden("minimal-output", shaders);
  });

  it("function-concrete: single function call from main", () => {
    const fn = buildPassthroughFloat("fnConcrete", "FnConcrete");

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const out = blueprint.addNode(0, 0, NODE_TYPES.output);
    const call = addCaller(fn);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(call.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], out.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    expect(shaders).not.toBeNull();
    compareGolden("function-concrete", shaders);
  });

  it("nested-functions: main → A → B, B declared before A", () => {
    const B = buildPassthroughFloat("fnB", "FnB");
    const A = buildPassthroughFloat("fnA", "FnA");

    // Replace A's body with a call to B.
    blueprint.setActiveGraph(A.id);
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const callB = addCaller(B);
    connect(aIn.outputPorts[0], callB.inputPorts[0]);
    connect(callB.outputPorts[0], aOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(0, 0, NODE_TYPES.output);
    const callA = addCaller(A);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(callA.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    expect(shaders).not.toBeNull();
    compareGolden("nested-functions", shaders);
  });
});
