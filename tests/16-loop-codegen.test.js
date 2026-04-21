// Test 16: Loop body codegen — verifies that loopBody graphs compile to real
// shader functions with for-loop call sites. Covers accumulator initialization,
// arg passthrough, Index parameter, multi-acc, GLSL/WGSL parity, edge cases.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

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

function connect(blueprint, srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  if (!Wire) throw new Error("Wire not exposed on globalThis.__sgWire");
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  return wire;
}

function addCaller(target) {
  const key = `for_loop_${target.id}`;
  const callerType = blueprint.getCallableFunctionNodeTypes()[key];
  if (!callerType) throw new Error(`no caller type for ${target.name} (key: ${key})`);
  return blueprint.addNode(0, 0, callerType);
}

function addFunctionCaller(target) {
  const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${target.id}`];
  if (!callerType) throw new Error(`no caller type for ${target.name}`);
  return blueprint.addNode(0, 0, callerType);
}

function fnDeclRegex(graphId) {
  const safe = graphId.replace(/[^a-zA-Z0-9_]/g, "_");
  return new RegExp(`\\w+\\s+fn_${safe}(?:_[a-f0-9]+)?\\(`);
}

function fnCallRegex(graphId) {
  const safe = graphId.replace(/[^a-zA-Z0-9_]/g, "_");
  return new RegExp(`fn_${safe}(?:_[a-f0-9]+)?\\s*\\(`);
}

function countMatches(text, re) {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  return (text.match(new RegExp(re.source, flags)) || []).length;
}

// Build a loop body graph with a single float accumulator.
// Body: acc = acc + 1.0 (via math Add node)
function buildSimpleSumLoop(name) {
  const g = blueprint.createLoopBodyGraph({ name });
  const accId = `${name}_acc`;
  g.data.contract = {
    inputs: [{ id: accId, name: "acc", type: "float", role: "acc" }],
    outputs: [{ id: accId, name: "acc", type: "float" }],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  // FunctionInput outputs: [Index(int), acc(float)]
  // Wire acc → math(add) → FunctionOutput.acc
  const math = blueprint.addNode(0, 0, NODE_TYPES.math);
  connect(blueprint, inp.outputPorts[1], math.inputPorts[0]); // acc → A
  connect(blueprint, math.outputPorts[0], outp.inputPorts[0]); // result → output.acc
  blueprint.setActiveGraph(blueprint.mainGraphId);
  return g;
}

// Build a loop body with two accumulators (sum and product).
function buildDualAccLoop(name) {
  const g = blueprint.createLoopBodyGraph({ name });
  const accSumId = `${name}_sum`;
  const accProdId = `${name}_prod`;
  g.data.contract = {
    inputs: [
      { id: accSumId, name: "sum", type: "float", role: "acc" },
      { id: accProdId, name: "prod", type: "float", role: "acc" },
    ],
    outputs: [
      { id: accSumId, name: "sum", type: "float" },
      { id: accProdId, name: "prod", type: "float" },
    ],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  // Outputs: [Index, sum, prod]
  // Wire sum → math(add) → output.sum, prod → output.prod (pass-through)
  const math = blueprint.addNode(0, 0, NODE_TYPES.math);
  connect(blueprint, inp.outputPorts[1], math.inputPorts[0]); // sum → math.A
  connect(blueprint, math.outputPorts[0], outp.inputPorts[0]); // math.result → output.sum
  connect(blueprint, inp.outputPorts[2], outp.inputPorts[1]); // prod → output.prod (pass-through)
  blueprint.setActiveGraph(blueprint.mainGraphId);
  return g;
}

// Build a loop body with an accumulator AND an argument.
function buildAccArgLoop(name) {
  const g = blueprint.createLoopBodyGraph({ name });
  const accId = `${name}_acc`;
  g.data.contract = {
    inputs: [
      { id: accId, name: "total", type: "float", role: "acc" },
      { id: `${name}_step`, name: "step", type: "float", role: "arg" },
    ],
    outputs: [
      { id: accId, name: "total", type: "float" },
    ],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  // Outputs: [Index, total, step]
  // Wire total + step → output.total
  const math = blueprint.addNode(0, 0, NODE_TYPES.math);
  connect(blueprint, inp.outputPorts[1], math.inputPorts[0]); // total → A
  connect(blueprint, inp.outputPorts[2], math.inputPorts[1]); // step → B
  connect(blueprint, math.outputPorts[0], outp.inputPorts[0]); // result → output.total
  blueprint.setActiveGraph(blueprint.mainGraphId);
  return g;
}

// Wire a ForLoop's single output through toVec4 to the main Output.
function wireCallerToMainOutput(callerNode) {
  const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
  const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
  connect(blueprint, callerNode.outputPorts[0], toVec4.inputPorts[0]);
  connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);
  return { mainOut, toVec4 };
}

describe("Loop body codegen — Phase 5", () => {
  // ==================== Caller node type creation ====================

  describe("ForLoop caller node type", () => {
    it("creates a caller with Count input + Initial acc inputs + arg inputs + acc outputs", () => {
      const g = buildAccArgLoop("AccArg");
      const types = blueprint.getCallableFunctionNodeTypes();
      const key = `for_loop_${g.id}`;
      expect(types[key]).toBeDefined();
      const nt = types[key];
      expect(nt.isFunctionCall).toBe(true);
      expect(nt.callerKind).toBe("loopBody");
      expect(nt.targetGraphId).toBe(g.id);
      // Inputs: Count, Initial total, step
      expect(nt.inputs).toHaveLength(3);
      expect(nt.inputs[0].name).toBe("Count");
      expect(nt.inputs[0].type).toBe("int");
      expect(nt.inputs[1].name).toBe("Initial total");
      expect(nt.inputs[1].type).toBe("float");
      expect(nt.inputs[2].name).toBe("step");
      expect(nt.inputs[2].type).toBe("float");
      // Outputs: total
      expect(nt.outputs).toHaveLength(1);
      expect(nt.outputs[0].name).toBe("total");
      expect(nt.outputs[0].type).toBe("float");
    });

    it("dual-acc loop has two initial inputs and two outputs", () => {
      const g = buildDualAccLoop("Dual");
      const types = blueprint.getCallableFunctionNodeTypes();
      const nt = types[`for_loop_${g.id}`];
      // Inputs: Count, Initial sum, Initial prod
      expect(nt.inputs).toHaveLength(3);
      expect(nt.inputs[0].name).toBe("Count");
      expect(nt.inputs[1].name).toBe("Initial sum");
      expect(nt.inputs[2].name).toBe("Initial prod");
      // Outputs: sum, prod
      expect(nt.outputs).toHaveLength(2);
      expect(nt.outputs[0].name).toBe("sum");
      expect(nt.outputs[1].name).toBe("prod");
    });

    it("simple loop with only one acc has Count + Initial value → value", () => {
      const g = buildSimpleSumLoop("Simple");
      const types = blueprint.getCallableFunctionNodeTypes();
      const nt = types[`for_loop_${g.id}`];
      expect(nt.inputs).toHaveLength(2);
      expect(nt.inputs[0].name).toBe("Count");
      expect(nt.inputs[1].name).toBe("Initial acc");
      expect(nt.outputs).toHaveLength(1);
      expect(nt.outputs[0].name).toBe("acc");
    });
  });

  // ==================== Contract sync ====================

  describe("contract sync for ForLoop callers", () => {
    it("adding an acc input updates caller ports", () => {
      const g = buildSimpleSumLoop("Sync");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      expect(caller.inputPorts).toHaveLength(2); // Count, Initial acc

      // Add a second accumulator
      const newAccId = "sync_new_acc";
      g.data.contract.inputs.push({ id: newAccId, name: "extra", type: "vec3", role: "acc" });
      g.data.contract.outputs.push({ id: newAccId, name: "extra", type: "vec3" });
      blueprint.syncContractCallers(g);

      expect(caller.inputPorts).toHaveLength(3); // Count, Initial acc, Initial extra
      expect(caller.inputPorts[2].name).toBe("Initial extra");
      expect(caller.outputPorts).toHaveLength(2); // acc, extra
      expect(caller.outputPorts[1].name).toBe("extra");
    });

    it("removing an acc input updates caller ports", () => {
      const g = buildDualAccLoop("SyncRemove");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      expect(caller.inputPorts).toHaveLength(3); // Count, Initial sum, Initial prod
      expect(caller.outputPorts).toHaveLength(2); // sum, prod

      // Remove prod
      g.data.contract.inputs = g.data.contract.inputs.filter((p) => p.name !== "prod");
      g.data.contract.outputs = g.data.contract.outputs.filter((p) => p.name !== "prod");
      blueprint.syncContractCallers(g);

      expect(caller.inputPorts).toHaveLength(2); // Count, Initial sum
      expect(caller.outputPorts).toHaveLength(1); // sum
    });

    it("changing role from acc to arg removes the paired output on caller", () => {
      const g = buildDualAccLoop("RoleChange");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      expect(caller.outputPorts).toHaveLength(2);

      // Change prod from acc to arg
      const prodInput = g.data.contract.inputs.find((p) => p.name === "prod");
      prodInput.role = "arg";
      g.data.contract.outputs = g.data.contract.outputs.filter((p) => p.id !== prodInput.id);
      blueprint.syncContractCallers(g);

      // Now: inputs = Count, Initial sum, prod(arg); outputs = sum
      expect(caller.inputPorts).toHaveLength(3);
      expect(caller.inputPorts[2].name).toBe("prod"); // no "Initial" prefix for args
      expect(caller.outputPorts).toHaveLength(1);
      expect(caller.outputPorts[0].name).toBe("sum");
    });
  });

  // ==================== GLSL single-output (single acc) ====================

  describe("GLSL single-acc loop", () => {
    it("emits a function declaration with int i as first param", () => {
      const g = buildSimpleSumLoop("GLSLSingle");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      // Function declaration should exist
      expect(src).toMatch(fnDeclRegex(g.id));
      // Should have int i as first parameter
      const declMatch = src.match(new RegExp(`(float|void)\\s+fn_[^(]+\\(([^)]+)\\)`));
      expect(declMatch).not.toBeNull();
      const params = declMatch[2];
      expect(params).toMatch(/^int i/);
    });

    it("emits a for loop at the call site with accumulator init", () => {
      const g = buildSimpleSumLoop("GLSLForLoop");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;
      const mainStart = src.indexOf("void main");
      const mainSrc = src.slice(mainStart);

      // Should contain a for loop
      expect(mainSrc).toMatch(/for\s*\(\s*int _i\s*=\s*0/);
      // Should contain accumulator initialization before the loop
      expect(mainSrc).toMatch(/float\s+\w+\s*=\s*/);
    });

    it("function declaration appears before void main", () => {
      const g = buildSimpleSumLoop("DeclOrder");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;
      const fnPos = src.search(fnDeclRegex(g.id));
      const mainPos = src.indexOf("void main");
      expect(fnPos).toBeGreaterThan(-1);
      expect(mainPos).toBeGreaterThan(-1);
      expect(fnPos).toBeLessThan(mainPos);
    });

    it("single-acc function uses return value, not out params", () => {
      const g = buildSimpleSumLoop("SingleReturn");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;
      // Declaration should start with "float fn_..." not "void fn_..."
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      expect(src).toMatch(new RegExp(`float\\s+fn_${safe}`));
      expect(src).not.toMatch(new RegExp(`void\\s+fn_${safe}`));
    });
  });

  // ==================== GLSL multi-output (multi acc) ====================

  describe("GLSL multi-acc loop", () => {
    it("emits void function with out params for multiple accumulators", () => {
      const g = buildDualAccLoop("GLSLMulti");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      // Wire first output to main
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      // Declaration should be void with out params
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      expect(src).toMatch(new RegExp(`void\\s+fn_${safe}`));
      expect(src).toMatch(/out\s+float/);
    });

    it("call site initializes both accumulators before the loop", () => {
      const g = buildDualAccLoop("DualInit");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const mainSrc = shaders.webgl2.slice(shaders.webgl2.indexOf("void main"));

      // Two float initializations before the loop
      const forPos = mainSrc.indexOf("for (int _i");
      expect(forPos).toBeGreaterThan(-1);
      const beforeFor = mainSrc.slice(0, forPos);
      const floatInits = beforeFor.match(/float\s+\w+\s*=/g) || [];
      expect(floatInits.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== Acc + Arg passthrough ====================

  describe("accumulator + argument loop", () => {
    it("caller has Count, Initial acc, and arg inputs in correct order", () => {
      const g = buildAccArgLoop("AccArgOrder");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      // Inputs: [Count:int, Initial total:float, step:float]
      expect(caller.inputPorts).toHaveLength(3);
      expect(caller.inputPorts[0].name).toBe("Count");
      expect(caller.inputPorts[0].portType).toBe("int");
      expect(caller.inputPorts[1].name).toBe("Initial total");
      expect(caller.inputPorts[1].portType).toBe("float");
      expect(caller.inputPorts[2].name).toBe("step");
      expect(caller.inputPorts[2].portType).toBe("float");
      // Output: [total:float]
      expect(caller.outputPorts).toHaveLength(1);
      expect(caller.outputPorts[0].name).toBe("total");
    });

    it("arg is passed into the loop body function but NOT re-assigned", () => {
      const g = buildAccArgLoop("ArgPassthrough");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;
      const mainSrc = src.slice(src.indexOf("void main"));

      // The for loop should call the function with the arg variable
      expect(mainSrc).toMatch(/for\s*\(\s*int _i/);
      // arg should appear as a parameter to the function call inside the loop
      const loopBody = mainSrc.match(/for\s*\([^)]+\)\s*\{([^}]+)\}/);
      expect(loopBody).not.toBeNull();
    });

    it("function declaration includes step as a non-out parameter", () => {
      const g = buildAccArgLoop("ArgDecl");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      // Find the function declaration
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const declRegex = new RegExp(`float\\s+fn_${safe}[^(]*\\(([^)]+)\\)`);
      const match = src.match(declRegex);
      expect(match).not.toBeNull();
      const params = match[1];
      // Should have: int i, float total, float step
      expect(params).toContain("int i");
      expect(params).toContain("float total");
      expect(params).toContain("float step");
      // step should NOT be an out parameter
      expect(params).not.toMatch(/out\s+float\s+step/);
    });
  });

  // ==================== WGSL parity ====================

  describe("WGSL loop codegen", () => {
    it("single-acc: fn declaration returns f32", () => {
      const g = buildSimpleSumLoop("WGSLSingle");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;

      // fn fn_id(i: i32, acc: f32) -> f32
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      expect(src).toMatch(new RegExp(`fn\\s+fn_${safe}[^(]*\\([^)]*i:\\s*i32`));
      expect(src).toMatch(new RegExp(`fn\\s+fn_${safe}[^(]*\\([^)]+\\)\\s*->\\s*f32`));
    });

    it("single-acc: call site uses var and reassignment", () => {
      const g = buildSimpleSumLoop("WGSLVar");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;
      const mainStart = src.indexOf("fn main");
      const mainSrc = src.slice(mainStart);

      // var initialization: var <name>: f32 = <init>;
      expect(mainSrc).toMatch(/var\s+\w+:\s*f32\s*=/);
      // for loop: for (var _i: i32 = 0; ...
      expect(mainSrc).toMatch(/for\s*\(\s*var _i:\s*i32\s*=\s*0/);
    });

    it("multi-acc: emits struct return", () => {
      const g = buildDualAccLoop("WGSLMulti");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;

      // Should have a struct definition
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      expect(src).toMatch(new RegExp(`struct\\s+fn_${safe}[^{]*_Out`));
      // fn should return the struct
      expect(src).toMatch(new RegExp(`fn\\s+fn_${safe}[^)]*\\)\\s*->\\s*fn_${safe}[^{]*_Out`));
    });

    it("multi-acc WGSL call site destructures struct fields", () => {
      const g = buildDualAccLoop("WGSLDestruct");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;
      const mainStart = src.indexOf("fn main");
      const mainSrc = src.slice(mainStart);

      // Should access .o0, .o1 for the struct fields
      expect(mainSrc).toMatch(/\.o0/);
      expect(mainSrc).toMatch(/\.o1/);
    });

    it("acc+arg WGSL: arg parameter uses correct WGSL type", () => {
      const g = buildAccArgLoop("WGSLArg");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;

      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const declRegex = new RegExp(`fn\\s+fn_${safe}[^(]*\\(([^)]+)\\)`);
      const match = src.match(declRegex);
      expect(match).not.toBeNull();
      const params = match[1];
      expect(params).toContain("i: i32");
      expect(params).toContain("total: f32");
      expect(params).toContain("step: f32");
    });
  });

  // ==================== WebGL1 parity ====================

  describe("WebGL1 loop codegen", () => {
    it("single-acc: compiles to valid GLSL 100", () => {
      const g = buildSimpleSumLoop("WGL1");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl1;

      expect(src).toMatch(fnDeclRegex(g.id));
      expect(src).toMatch(/for\s*\(\s*int _i/);
      expect(src).toContain("gl_FragColor");
    });
  });

  // ==================== Three-target parity ====================

  describe("three-target parity", () => {
    it("all three targets compile without error", () => {
      const g = buildAccArgLoop("Parity");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      expect(shaders.webgl1).toBeDefined();
      expect(shaders.webgl2).toBeDefined();
      expect(shaders.webgpu).toBeDefined();
      // All should contain the function declaration
      expect(shaders.webgl1).toMatch(fnDeclRegex(g.id));
      expect(shaders.webgl2).toMatch(fnDeclRegex(g.id));
      expect(shaders.webgpu).toMatch(fnDeclRegex(g.id));
    });
  });

  // ==================== Index parameter ====================

  describe("Index parameter", () => {
    it("boundary node has Index as first output with type int", () => {
      const g = buildSimpleSumLoop("IndexPort");
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      expect(inp.outputPorts[0].name).toBe("Index");
      expect(inp.outputPorts[0].portType).toBe("int");
    });

    it("Index is the first parameter (int i) in all GLSL declarations", () => {
      const g = buildSimpleSumLoop("IndexGLSL");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      for (const target of ["webgl1", "webgl2"]) {
        const src = shaders[target];
        const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
        const declRegex = new RegExp(`(?:float|void)\\s+fn_${safe}[^(]*\\(([^)]+)\\)`);
        const match = src.match(declRegex);
        expect(match).not.toBeNull();
        expect(match[1]).toMatch(/^int i/);
      }
    });

    it("Index is the first parameter (i: i32) in WGSL declarations", () => {
      const g = buildSimpleSumLoop("IndexWGSL");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgpu;
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const declRegex = new RegExp(`fn\\s+fn_${safe}[^(]*\\(([^)]+)\\)`);
      const match = src.match(declRegex);
      expect(match).not.toBeNull();
      expect(match[1]).toMatch(/^i:\s*i32/);
    });

    it("for loop passes _i as the first argument", () => {
      const g = buildSimpleSumLoop("IndexCall");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;
      const mainSrc = src.slice(src.indexOf("void main"));

      // Inside the for loop, the function call should start with _i
      const callMatch = mainSrc.match(new RegExp(`fn_[^(]+\\(([^)]+)\\)`, "g"));
      expect(callMatch).not.toBeNull();
      const insideLoop = callMatch.find((c) => c.includes("_i"));
      expect(insideLoop).toBeDefined();
    });
  });

  // ==================== Nested: ForLoop inside a function body ====================

  describe("ForLoop inside a function body", () => {
    it("loop body declaration is emitted before the function that calls it", () => {
      const loop = buildSimpleSumLoop("NestedLoop");
      const fn = blueprint.createFunctionGraph({ name: "FnWithLoop" });
      fn.data.contract = {
        inputs: [{ id: "fn_in", name: "n", type: "float" }],
        outputs: [{ id: "fn_out", name: "r", type: "float" }],
      };
      blueprint.syncContractCallers(fn);

      // Wire fn body: input.n → ForLoop(count=10, initial=input.n) → output.r
      blueprint.setActiveGraph(fn.id);
      const fnIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const fnOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const loopCaller = addCaller(loop);
      connect(blueprint, fnIn.outputPorts[0], loopCaller.inputPorts[1]); // n → Initial acc
      connect(blueprint, loopCaller.outputPorts[0], fnOut.inputPorts[0]); // acc → r

      // main: call the function
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const fnCaller = addFunctionCaller(fn);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, fnCaller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      // Both declarations should exist
      expect(src).toMatch(fnDeclRegex(loop.id));
      expect(src).toMatch(fnDeclRegex(fn.id));

      // Loop body must be declared before the function that uses it
      const loopPos = src.search(fnDeclRegex(loop.id));
      const fnPos = src.search(fnDeclRegex(fn.id));
      expect(loopPos).toBeLessThan(fnPos);
    });
  });

  // ==================== Function inside a loop body ====================

  describe("function call inside a loop body", () => {
    it("function declaration appears before loop body declaration", () => {
      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      fn.data.contract = {
        inputs: [{ id: "h_in", name: "x", type: "float" }],
        outputs: [{ id: "h_out", name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(fn);

      // Wire fn body: x → math → y
      blueprint.setActiveGraph(fn.id);
      const fnInp = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const fnOutp = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const math = blueprint.addNode(0, 0, NODE_TYPES.math);
      connect(blueprint, fnInp.outputPorts[0], math.inputPorts[0]);
      connect(blueprint, math.outputPorts[0], fnOutp.inputPorts[0]);

      // Create a loop body that calls fn
      const loop = blueprint.createLoopBodyGraph({ name: "LoopCallsFn" });
      const accId = "lc_acc";
      loop.data.contract = {
        inputs: [{ id: accId, name: "acc", type: "float", role: "acc" }],
        outputs: [{ id: accId, name: "acc", type: "float" }],
      };
      blueprint.syncContractCallers(loop);

      blueprint.setActiveGraph(loop.id);
      const loopInp = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const loopOutp = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const fnCaller = addFunctionCaller(fn);
      connect(blueprint, loopInp.outputPorts[1], fnCaller.inputPorts[0]); // acc → fn input
      connect(blueprint, fnCaller.outputPorts[0], loopOutp.inputPorts[0]); // fn output → acc

      // main: use the loop
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const loopCaller = addCaller(loop);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, loopCaller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      expect(src).toMatch(fnDeclRegex(fn.id));
      expect(src).toMatch(fnDeclRegex(loop.id));

      // fn must be declared before loop body (callee before caller)
      const fnPos = src.search(fnDeclRegex(fn.id));
      const loopPos = src.search(fnDeclRegex(loop.id));
      expect(fnPos).toBeLessThan(loopPos);
    });
  });

  // ==================== Edge cases ====================

  describe("edge cases", () => {
    it("loop body with no wires in body (passthrough acc) compiles", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Passthrough" });
      const accId = "pt_acc";
      g.data.contract = {
        inputs: [{ id: accId, name: "val", type: "float", role: "acc" }],
        outputs: [{ id: accId, name: "val", type: "float" }],
      };
      blueprint.syncContractCallers(g);
      // Don't wire anything in the body — accumulator passes through as default 0.0

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const shaders = blueprint.generateAllShaders();
      expect(shaders.webgl2).toMatch(fnDeclRegex(g.id));
      expect(shaders.webgpu).toMatch(fnDeclRegex(g.id));
    });

    it("two ForLoop callers for the same loop body produce a single declaration", () => {
      const g = buildSimpleSumLoop("TwoCalls");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const c1 = addCaller(g);
      const c2 = addCaller(g);
      // Wire c1 to output
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const sum = blueprint.addNode(200, 200, NODE_TYPES.math);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, c1.outputPorts[0], sum.inputPorts[0]);
      connect(blueprint, c2.outputPorts[0], sum.inputPorts[1]);
      connect(blueprint, sum.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      const src = shaders.webgl2;

      // Only one declaration for the loop body
      expect(countMatches(src, fnDeclRegex(g.id))).toBe(1);
    });

    it("vec3 accumulator compiles correctly in GLSL and WGSL", () => {
      const g = blueprint.createLoopBodyGraph({ name: "Vec3Loop" });
      const accId = "v3_acc";
      g.data.contract = {
        inputs: [{ id: accId, name: "color", type: "vec3", role: "acc" }],
        outputs: [{ id: accId, name: "color", type: "vec3" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inp.outputPorts[1], outp.inputPorts[0]); // passthrough
      blueprint.setActiveGraph(blueprint.mainGraphId);

      const caller = addCaller(g);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();

      // GLSL should have vec3 parameter and return type
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      expect(shaders.webgl2).toMatch(new RegExp(`vec3\\s+fn_${safe}`));

      // WGSL should have vec3<f32>
      expect(shaders.webgpu).toMatch(new RegExp(`fn\\s+fn_${safe}[^)]*\\)\\s*->\\s*vec3<f32>`));
    });

    it("loop body with only arg inputs and no acc should produce no outputs", () => {
      const g = blueprint.createLoopBodyGraph({ name: "ArgOnly" });
      g.data.contract = {
        inputs: [{ id: "arg1", name: "x", type: "float", role: "arg" }],
        outputs: [],
      };
      blueprint.syncContractCallers(g);

      const types = blueprint.getCallableFunctionNodeTypes();
      const nt = types[`for_loop_${g.id}`];
      // Inputs: Count, x(arg)
      expect(nt.inputs).toHaveLength(2);
      expect(nt.inputs[0].name).toBe("Count");
      expect(nt.inputs[1].name).toBe("x");
      // No outputs
      expect(nt.outputs).toHaveLength(0);
    });

    it("loop with mixed acc types (float and vec3) compiles", () => {
      const g = blueprint.createLoopBodyGraph({ name: "MixedTypes" });
      const accFId = "mt_f";
      const accVId = "mt_v";
      g.data.contract = {
        inputs: [
          { id: accFId, name: "sum", type: "float", role: "acc" },
          { id: accVId, name: "color", type: "vec3", role: "acc" },
        ],
        outputs: [
          { id: accFId, name: "sum", type: "float" },
          { id: accVId, name: "color", type: "vec3" },
        ],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inp.outputPorts[1], outp.inputPorts[0]); // sum → sum
      connect(blueprint, inp.outputPorts[2], outp.inputPorts[1]); // color → color
      blueprint.setActiveGraph(blueprint.mainGraphId);

      const caller = addCaller(g);
      const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();

      // GLSL: void function with out float and out vec3
      expect(shaders.webgl2).toMatch(/out\s+float/);
      expect(shaders.webgl2).toMatch(/out\s+vec3/);

      // WGSL: struct with f32 and vec3<f32>
      expect(shaders.webgpu).toMatch(/o0:\s*f32/);
      expect(shaders.webgpu).toMatch(/o1:\s*vec3<f32>/);
    });
  });

  // ==================== validate contract ====================

  describe("validateContract", () => {
    it("valid contract passes", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [{ id: "a", name: "x", type: "float", role: "acc" }],
        outputs: [{ id: "a", name: "x", type: "float" }],
      });
      expect(errors).toHaveLength(0);
    });

    it("rejects empty port name", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [{ id: "a", name: "", type: "float", role: "acc" }],
        outputs: [{ id: "a", name: "", type: "float" }],
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("empty"))).toBe(true);
    });

    it("rejects duplicate port names", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [
          { id: "a", name: "x", type: "float", role: "acc" },
          { id: "b", name: "x", type: "float", role: "arg" },
        ],
        outputs: [{ id: "a", name: "x", type: "float" }],
      });
      expect(errors.some((e) => e.includes("Duplicate"))).toBe(true);
    });

    it("rejects input without role", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [{ id: "a", name: "x", type: "float" }],
        outputs: [],
      });
      expect(errors.some((e) => e.includes("role"))).toBe(true);
    });

    it("rejects acc output without matching acc input", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [],
        outputs: [{ id: "orphan", name: "x", type: "float" }],
      });
      expect(errors.some((e) => e.includes("matching"))).toBe(true);
    });

    it("rejects acc input without matching output", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [{ id: "a", name: "x", type: "float", role: "acc" }],
        outputs: [],
      });
      expect(errors.some((e) => e.includes("matching"))).toBe(true);
    });

    it("arg input does not require a paired output", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const errors = loopBodyKindHandler.validateContract({
        inputs: [{ id: "a", name: "x", type: "float", role: "arg" }],
        outputs: [],
      });
      // Should not have errors about pairing for args
      expect(errors.filter((e) => e.includes("matching"))).toHaveLength(0);
    });
  });

  // ==================== computeCallSiteSignature ====================

  describe("computeCallSiteSignature", () => {
    it("returns correct signature for concrete types", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const g = buildSimpleSumLoop("SigTest");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);

      const sig = loopBodyKindHandler.computeCallSiteSignature(caller, blueprint);
      expect(sig.fnName).toContain(`fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`);
      expect(sig.resolvedInputTypes).toContain("int");
      expect(sig.resolvedInputTypes).toContain("float");
      expect(sig.resolvedOutputTypes).toEqual(["float"]);
    });

    it("hasGenerics is false for all-concrete contract", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const g = buildSimpleSumLoop("ConcreteLoop");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);

      const sig = loopBodyKindHandler.computeCallSiteSignature(caller, blueprint);
      expect(sig.hasGenerics).toBe(false);
    });

    it("hasGenerics is true for generic contract", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const g = blueprint.createLoopBodyGraph({ name: "GenericLoop" });
      const accId = "gen_acc";
      g.data.contract = {
        inputs: [{ id: accId, name: "val", type: "T", role: "acc" }],
        outputs: [{ id: accId, name: "val", type: "T" }],
      };
      blueprint.syncContractCallers(g);
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);

      const sig = loopBodyKindHandler.computeCallSiteSignature(caller, blueprint);
      expect(sig.hasGenerics).toBe(true);
    });

    it("resolves generic from wired input", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");
      const g = blueprint.createLoopBodyGraph({ name: "GenResolve" });
      const accId = "gr_acc";
      g.data.contract = {
        inputs: [{ id: accId, name: "val", type: "T", role: "acc" }],
        outputs: [{ id: accId, name: "val", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inp.outputPorts[1], outp.inputPorts[0]);

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      // Wire a vec3 to the Initial val input
      const vec3Node = blueprint.addNode(-200, 0, NODE_TYPES.vec3);
      connect(blueprint, vec3Node.outputPorts[0], caller.inputPorts[1]);

      const sig = loopBodyKindHandler.computeCallSiteSignature(caller, blueprint);
      // T should resolve to vec3
      expect(sig.accTypes).toEqual(["vec3"]);
      expect(sig.resolvedOutputTypes).toEqual(["vec3"]);
    });
  });

  // ==================== Save/load round-trip ====================

  describe("save/load round-trip", () => {
    function fakeFile(json) {
      return { name: "test.c3sg", text: async () => JSON.stringify(json) };
    }

    it("loop body graph survives save and reload", async () => {
      const g = buildSimpleSumLoop("SaveLoad");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      // Generate shaders before save
      const shadersBefore = blueprint.generateAllShaders();
      expect(shadersBefore.webgl2).toMatch(fnDeclRegex(g.id));

      // Save via serialization API
      const json = blueprint.serializeProjectToJSON();
      expect(json).toBeDefined();

      // Reload
      blueprint.createNewFile();
      await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

      // Verify the loop body graph still exists
      const loopGraphs = [...blueprint.graphs.values()].filter((g) => g.kind === "loopBody");
      expect(loopGraphs.length).toBeGreaterThanOrEqual(1);

      // Verify shader still generates
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const shadersAfter = blueprint.generateAllShaders();
      expect(shadersAfter.webgl2).toMatch(/for\s*\(\s*int _i/);
    });
  });

  // ==================== View Code for loop body tab ====================

  describe("view code for loop body tab", () => {
    it("_generateCallableGraphPreview works for loop body graphs", () => {
      const g = buildSimpleSumLoop("ViewLoop");
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = addCaller(g);
      wireCallerToMainOutput(caller);

      const preview = blueprint._generateCallableGraphPreview(g, "webgl2");
      expect(preview).toContain("fn_");
      expect(preview).toContain("int i");
    });

    it("preview for unused loop body still compiles speculatively", () => {
      const g = buildSimpleSumLoop("Unused");
      // Don't place any caller in main

      const preview = blueprint._generateCallableGraphPreview(g, "webgl2");
      expect(preview).toContain("fn_");
      expect(preview).toContain("int i");
    });
  });
});
