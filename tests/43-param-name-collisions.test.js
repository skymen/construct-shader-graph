// Issue #120, last part — "maybe automatically add in_ and out_ in the param
// names".
//
// Emitted parameters used to take the port name verbatim on the input side
// while only outputs got a prefix, which left three ways for two different
// values to end up sharing one identifier in the generated shader:
//
//   1. a function input literally named `out_result` vs an output named
//      `result`;
//   2. a loop body port named `i` or `n`, shadowing the injected index/count
//      parameters;
//   3. a WGSL function input named `input`, colliding with the implicit
//      `input: FragmentInput` parameter.
//
// Prefixing every contract-derived parameter makes all three unreachable.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
});

function connect(srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  return wire;
}

// A function graph that passes its single input straight through.
function passthroughFunction(name, inputName, outputName) {
  const g = blueprint.createFunctionGraph({ name });
  g.data.contract = {
    inputs: [{ id: "i1", name: inputName, type: "float" }],
    outputs: [{ id: "o1", name: outputName, type: "float" }],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  connect(inp.outputPorts[0], outp.inputPorts[0]);
  blueprint.setActiveGraph(blueprint.mainGraphId);
  return g;
}

function callAndGenerate(g, prefix) {
  const callerType =
    blueprint.getCallableFunctionNodeTypes()[`${prefix}_${g.id}`];
  const caller = blueprint.addNode(0, 0, callerType);
  const out = blueprint.mainGraph.nodes.find(
    (n) => n.nodeType === NODE_TYPES.output,
  );
  const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
  connect(caller.outputPorts[0], toVec4.inputPorts[0]);
  connect(toVec4.outputPorts[0], out.inputPorts[0]);
  return blueprint.generateAllShaders();
}

describe("EMITTED PARAM NAME COLLISIONS (#120)", () => {
  it("prefixes every function parameter", () => {
    const g = passthroughFunction("Pass", "value", "result");
    const shaders = callAndGenerate(g, "function_call");
    expect(shaders.webgl2).toContain("float in_value");
    expect(shaders.webgpu).toContain("in_value: f32");
  });

  it("keeps an input named out_result distinct from an output named result", () => {
    const g = passthroughFunction("Clash", "out_result", "result");
    const shaders = callAndGenerate(g, "function_call");
    // in_out_result vs out_result — different identifiers.
    expect(shaders.webgl2).toContain("in_out_result");
    for (const src of Object.values(shaders)) {
      expect(src).not.toMatch(/\bfloat out_result\s*,/);
    }
  });

  it("does not let a function input named `input` collide in WGSL", () => {
    const g = passthroughFunction("WgslClash", "input", "result");
    const shaders = callAndGenerate(g, "function_call");
    // The implicit FragmentInput param must still be the only bare `input`.
    expect(shaders.webgpu).toContain("input: FragmentInput, in_input: f32");
  });

  it("does not let a loop body port shadow the injected index/count", () => {
    const g = blueprint.createLoopBodyGraph({ name: "Shadow" });
    g.data.contract = {
      inputs: [{ id: "s1", name: "n", type: "float" }],
      outputs: [{ id: "a1", name: "i", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(inp.outputPorts[2], outp.inputPorts[0]); // acc "i" passthrough
    blueprint.setActiveGraph(blueprint.mainGraphId);

    const shaders = callAndGenerate(g, "for_loop");
    const decl = shaders.webgl2.match(/float fn_[^(]*\(([^)]*)\)/);
    expect(decl).not.toBeNull();
    // int i, int n are the injected pair; the user's ports are in_i / in_n.
    expect(decl[1]).toContain("int i");
    expect(decl[1]).toContain("int n");
    expect(decl[1]).toContain("in_i");
    expect(decl[1]).toContain("in_n");
  });

  it("declaration and body agree on every parameter name", () => {
    // The body used to derive names by indexing contract.inputs while the
    // declaration derived them from the boundary ports, so for a loop body with
    // both an accumulator and an argument they disagreed — the body referenced
    // an identifier the declaration never introduced.
    const g = blueprint.createLoopBodyGraph({ name: "AccArg" });
    g.data.contract = {
      inputs: [{ id: "s1", name: "step", type: "float" }],
      outputs: [{ id: "a1", name: "total", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    connect(inp.outputPorts[2], math.inputPorts[0]); // total
    connect(inp.outputPorts[3], math.inputPorts[1]); // step
    connect(math.outputPorts[0], outp.inputPorts[0]);
    blueprint.setActiveGraph(blueprint.mainGraphId);

    const src = callAndGenerate(g, "for_loop").webgl2;
    const body = src.slice(src.indexOf("fn_"));
    expect(body).toContain("in_total");
    expect(body).toContain("in_step");
    // The old failure mode: a positional fallback name that nothing declares.
    expect(src).not.toMatch(/\bin_p\d/);
    expect(src).not.toMatch(/\bp\d\b/);
  });
});
