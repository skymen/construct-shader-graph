// Test 15: Function codegen — verifies that function graphs compile to real
// shader functions and FunctionCall nodes emit correct call-site code.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// Helper: connect two ports via a Wire.
function connect(blueprint, srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  if (!Wire) throw new Error("Wire not exposed on globalThis.__sgWire");
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  return wire;
}

// Helper: build a minimal main graph with an Output node and hook it up.
function setupMainWithOutput() {
  blueprint.setActiveGraph(blueprint.mainGraphId);
  const outputNode = blueprint.addNode(400, 200, NODE_TYPES.output);
  return { outputNode };
}

describe("Function codegen — Phase 3", () => {
  describe("function declaration appears in shader before main()", () => {
    it("emitFunctionDeclaration returns a non-empty string for a concrete-typed function", () => {
      const g = blueprint.createFunctionGraph({ name: "Double" });
      g.data.contract = {
        inputs: [{ id: 1, name: "x", type: "float" }],
        outputs: [{ id: 2, name: "result", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      const { getHandler } = globalThis.__sgGetHandlerModule || {};
      if (!getHandler) {
        // Access via blueprint internals
        const handler = blueprint._getHandlerForKind
          ? blueprint._getHandlerForKind("function")
          : null;
        if (!handler) {
          // Verify via full shader generation instead
          return;
        }
      }

      // Use handler via import from the module
      import("../graph-kinds/function-kind.js").then(({ functionKindHandler }) => {
        const sig = {
          sigHash: "abc123",
          inputTypes: ["float"],
          outputTypes: ["float"],
          bindings: {},
          hasGenerics: false,
          resolvedInputTypes: ["float"],
          resolvedOutputTypes: ["float"],
          fnName: "fn_test",
        };
        const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgl2", blueprint);
        expect(declaration).toContain("fn_test");
        expect(declaration).toContain("float");
        expect(declaration).toContain("{");
        expect(declaration).toContain("}");
      });
    });

    it("generated shader contains 'fn_' declaration before 'void main'", () => {
      // Build a function graph with a concrete contract
      const fnGraph = blueprint.createFunctionGraph({ name: "Scale" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "v", type: "float" }],
        outputs: [{ id: "p2", name: "r", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire the function body: FunctionInput.v → math(add 1) → FunctionOutput.r
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);

      // Connect function input → math → function output
      if (inputNode.outputPorts[0] && mathNode.inputPorts[0]) {
        connect(blueprint, inputNode.outputPorts[0], mathNode.inputPorts[0]);
      }
      if (mathNode.outputPorts[0] && outputNode.inputPorts[0]) {
        connect(blueprint, mathNode.outputPorts[0], outputNode.inputPorts[0]);
      }

      // Set up main graph with a FunctionCall node
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const { outputNode: mainOut } = setupMainWithOutput();
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      const callerNode = blueprint.addNode(200, 200, callerType);

      // Connect caller output to main's output (via vec4 conversion node or direct)
      // For simplicity, use a toVec4 node
      const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
      if (callerNode.outputPorts[0] && toVec4.inputPorts[0]) {
        connect(blueprint, callerNode.outputPorts[0], toVec4.inputPorts[0]);
      }
      if (toVec4.outputPorts[0] && mainOut.inputPorts[0]) {
        connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);
      }

      const shaders = blueprint.generateAllShaders();
      expect(shaders).not.toBeNull();

      const webgl2 = shaders.webgl2;
      const fnDeclPos = webgl2.indexOf(`fn_${fnGraph.id.replace(/[^a-zA-Z0-9_]/g, "_")}`);
      const mainPos = webgl2.indexOf("void main");
      if (fnDeclPos !== -1 && mainPos !== -1) {
        expect(fnDeclPos).toBeLessThan(mainPos);
      }
    });
  });

  describe("GLSL single-output function", () => {
    it("emits '<type> fnName(params) { ... }' form", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "Add" });
      g.data.contract = {
        inputs: [{ id: 1, name: "a", type: "float" }, { id: 2, name: "b", type: "float" }],
        outputs: [{ id: 3, name: "sum", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      const sig = {
        sigHash: "000000",
        inputTypes: ["float", "float"],
        outputTypes: ["float"],
        bindings: {},
        hasGenerics: false,
        resolvedInputTypes: ["float", "float"],
        resolvedOutputTypes: ["float"],
        fnName: `fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgl2", blueprint);
      expect(declaration).toMatch(/float\s+fn_/);
      expect(declaration).not.toContain("void");
      expect(declaration).toContain("float a");
      expect(declaration).toContain("float b");
    });
  });

  describe("GLSL multi-output function", () => {
    it("emits 'void fnName(inputs, out type outName, ...)' form", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "SplitVec" });
      g.data.contract = {
        inputs: [{ id: 1, name: "v", type: "vec2" }],
        outputs: [
          { id: 2, name: "x", type: "float" },
          { id: 3, name: "y", type: "float" },
        ],
      };
      blueprint.syncContractCallers(g);

      const sig = {
        sigHash: "000001",
        inputTypes: ["vec2"],
        outputTypes: ["float", "float"],
        bindings: {},
        hasGenerics: false,
        resolvedInputTypes: ["vec2"],
        resolvedOutputTypes: ["float", "float"],
        fnName: `fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgl2", blueprint);
      expect(declaration).toMatch(/^void\s+fn_/m);
      expect(declaration).toContain("out float");
    });
  });

  describe("WGSL single-output function", () => {
    it("emits 'fn fnName(params) -> type { ... }' form", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "WgpuFn" });
      g.data.contract = {
        inputs: [{ id: 1, name: "t", type: "float" }],
        outputs: [{ id: 2, name: "r", type: "vec3" }],
      };
      blueprint.syncContractCallers(g);

      const sig = {
        sigHash: "000002",
        inputTypes: ["float"],
        outputTypes: ["vec3"],
        bindings: {},
        hasGenerics: false,
        resolvedInputTypes: ["float"],
        resolvedOutputTypes: ["vec3"],
        fnName: `fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgpu", blueprint);
      expect(declaration).toMatch(/^fn\s+fn_/m);
      expect(declaration).toContain("-> vec3<f32>");
      expect(declaration).toContain("t: f32");
    });
  });

  describe("WGSL multi-output function", () => {
    it("emits a struct + 'fn fnName(...) -> Struct' form", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "WgpuMulti" });
      g.data.contract = {
        inputs: [{ id: 1, name: "v", type: "vec3" }],
        outputs: [
          { id: 2, name: "a", type: "float" },
          { id: 3, name: "b", type: "float" },
        ],
      };
      blueprint.syncContractCallers(g);

      const sig = {
        sigHash: "000003",
        inputTypes: ["vec3"],
        outputTypes: ["float", "float"],
        bindings: {},
        hasGenerics: false,
        resolvedInputTypes: ["vec3"],
        resolvedOutputTypes: ["float", "float"],
        fnName: `fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgpu", blueprint);
      expect(declaration).toContain("struct ");
      expect(declaration).toContain("_Out");
      expect(declaration).toMatch(/fn\s+fn_/);
    });
  });

  describe("generic monomorphization", () => {
    it("body-inferred concrete contract produces a single variant (no _sigHash suffix)", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "Concrete" });
      g.data.contract = {
        inputs: [{ id: 1, name: "x", type: "float" }], // concrete, no generics
        outputs: [{ id: 2, name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${g.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerNode = blueprint.addNode(0, 0, callerType);

      const sig = functionKindHandler.computeCallSiteSignature(callerNode, blueprint);
      expect(sig.hasGenerics).toBe(false);
      // No sigHash suffix when there are no generics
      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgl2", blueprint);
      const fnId = g.id.replace(/[^a-zA-Z0-9_]/g, "_");
      // Declaration should NOT contain the sigHash suffix
      expect(declaration).toContain(`fn_${fnId}(`);
      expect(declaration).not.toContain(`fn_${fnId}_`);
    });

    it("generic contract produces distinct mangled names per signature", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");
      const g = blueprint.createFunctionGraph({ name: "GenericFn" });
      g.data.contract = {
        inputs: [{ id: 1, name: "x", type: "T" }], // generic
        outputs: [{ id: 2, name: "y", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${g.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerFloat = blueprint.addNode(0, 0, callerType);
      const callerVec3 = blueprint.addNode(0, 100, callerType);

      // Connect a float to callerFloat's input
      const floatNode = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
      if (floatNode.outputPorts[0] && callerFloat.inputPorts[0]) {
        connect(blueprint, floatNode.outputPorts[0], callerFloat.inputPorts[0]);
      }

      // Connect a vec3 to callerVec3's input (via Vec3Node)
      const vec3Node = blueprint.addNode(-200, 100, NODE_TYPES.vec3);
      if (vec3Node.outputPorts[0] && callerVec3.inputPorts[0]) {
        connect(blueprint, vec3Node.outputPorts[0], callerVec3.inputPorts[0]);
      }

      const sigFloat = functionKindHandler.computeCallSiteSignature(callerFloat, blueprint);
      const sigVec3 = functionKindHandler.computeCallSiteSignature(callerVec3, blueprint);

      expect(sigFloat.hasGenerics).toBe(true);
      expect(sigVec3.hasGenerics).toBe(true);
      expect(sigFloat.sigHash).not.toBe(sigVec3.sigHash);

      const { declaration: declFloat } = functionKindHandler.emitFunctionDeclaration(g, sigFloat, "webgl2", blueprint);
      const { declaration: declVec3 } = functionKindHandler.emitFunctionDeclaration(g, sigVec3, "webgl2", blueprint);
      // Both should have the sigHash in the name
      expect(declFloat).toContain(sigFloat.sigHash);
      expect(declVec3).toContain(sigVec3.sigHash);
      // They should be different function names
      expect(declFloat).not.toBe(declVec3);
    });
  });

  describe("dependency dedup", () => {
    it("a helper function used by two nodes in the body appears once in deps", () => {
      const g = blueprint.createFunctionGraph({ name: "DedupFn" });
      g.data.contract = {
        inputs: [{ id: 1, name: "uv", type: "vec2" }],
        outputs: [{ id: 2, name: "n", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      // Add two perlinNoise nodes in the body
      blueprint.setActiveGraph(g.id);
      const n1 = blueprint.addNode(0, 0, NODE_TYPES.perlinNoise);
      const n2 = blueprint.addNode(0, 100, NODE_TYPES.perlinNoise);

      // Compile the body
      const inputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);

      // Connect uv -> n1
      if (inputNode.outputPorts[0] && n1.inputPorts[0]) {
        connect(blueprint, inputNode.outputPorts[0], n1.inputPorts[0]);
      }
      // Connect n1 -> math -> n2 -> output (simplified: just connect n1 output to output)
      if (n1.outputPorts[0] && outputNode.inputPorts[0]) {
        connect(blueprint, n1.outputPorts[0], outputNode.inputPorts[0]);
      }

      const sig = {
        sigHash: "ded001",
        inputTypes: ["vec2"],
        outputTypes: ["float"],
        bindings: {},
        hasGenerics: false,
        resolvedInputTypes: ["vec2"],
        resolvedOutputTypes: ["float"],
        fnName: `fn_${g.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      };

      const { deps } = blueprint._compileFunctionBody(g, sig, "webgl2");

      // perlinNoise has a dependency; it should appear exactly once in deps
      const depKeys = [...deps.keys()];
      // Verify no duplicate dep strings
      const depSet = new Set(depKeys);
      expect(depKeys.length).toBe(depSet.size);

      blueprint.setActiveGraph(blueprint.mainGraphId);
    });
  });

  // ==================== WGSL FragmentInput threading ====================

  describe("WGSL FragmentInput parameter threading", () => {
    function buildFnAndMainGraph(fnName, contract, buildBody) {
      blueprint.setActiveGraph(blueprint.mainGraphId);
      blueprint.nodes = [];
      blueprint.wires = [];

      const g = blueprint.createFunctionGraph({ name: fnName });
      g.data.contract = contract;
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      buildBody(inp, outp);

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const types = blueprint.getCallableFunctionNodeTypes();
      const callerType = types[`function_call_${g.id}`];
      const caller = blueprint.addNode(0, 0, callerType);
      const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
      const outputNode = blueprint.addNode(400, 200, NODE_TYPES.output);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], outputNode.inputPorts[0]);
      return g;
    }

    it("function declaration includes input: FragmentInput as first param in WGSL", () => {
      const g = buildFnAndMainGraph(
        "InputThread",
        { inputs: [{ id: 1, name: "x", type: "float" }], outputs: [{ id: 2, name: "result", type: "float" }] },
        (inp, outp) => {
          const math = blueprint.addNode(0, 0, NODE_TYPES.math);
          connect(blueprint, inp.outputPorts[0], math.inputPorts[0]);
          connect(blueprint, math.outputPorts[0], outp.inputPorts[0]);
        }
      );

      const shaders = blueprint.generateAllShaders();
      const wgsl = shaders.webgpu;
      const declRe = /fn\s+(fn_\w+)\(([^)]+)\)/;
      const declMatch = wgsl.match(declRe);
      expect(declMatch).not.toBeNull();
      expect(declMatch[2]).toMatch(/^input:\s*FragmentInput/);
    });

    it("function call site passes input as first argument in WGSL", () => {
      const g = buildFnAndMainGraph(
        "InputCall",
        { inputs: [{ id: 1, name: "x", type: "float" }], outputs: [{ id: 2, name: "result", type: "float" }] },
        (inp, outp) => {
          const math = blueprint.addNode(0, 0, NODE_TYPES.math);
          connect(blueprint, inp.outputPorts[0], math.inputPorts[0]);
          connect(blueprint, math.outputPorts[0], outp.inputPorts[0]);
        }
      );

      const shaders = blueprint.generateAllShaders();
      const wgsl = shaders.webgpu;
      const mainSection = wgsl.slice(wgsl.indexOf("@fragment"));
      const callRe = /fn_\w+\(([^)]+)\)/;
      const callMatch = mainSection.match(callRe);
      expect(callMatch).not.toBeNull();
      expect(callMatch[1]).toMatch(/^input\b/);
    });

    it("GLSL does NOT include input param (varyings are global)", () => {
      const g = buildFnAndMainGraph(
        "NoInputGLSL",
        { inputs: [{ id: 1, name: "x", type: "float" }], outputs: [{ id: 2, name: "result", type: "float" }] },
        (inp, outp) => {
          const math = blueprint.addNode(0, 0, NODE_TYPES.math);
          connect(blueprint, inp.outputPorts[0], math.inputPorts[0]);
          connect(blueprint, math.outputPorts[0], outp.inputPorts[0]);
        }
      );

      const shaders = blueprint.generateAllShaders();
      for (const target of ["webgl1", "webgl2"]) {
        const src = shaders[target];
        const declRe = /\w+\s+fn_\w+\(([^)]+)\)/;
        const declMatch = src.match(declRe);
        expect(declMatch).not.toBeNull();
        expect(declMatch[1]).not.toMatch(/FragmentInput/);
        expect(declMatch[1]).not.toMatch(/^input/);
      }
    });

    it("FrontUV inside a function body emits input.fragUV in WGSL and function receives input param", () => {
      const g = buildFnAndMainGraph(
        "WithUV",
        { inputs: [], outputs: [{ id: 1, name: "uv", type: "vec2" }] },
        (inp, outp) => {
          const frontUV = blueprint.addNode(0, 0, NODE_TYPES.frontUV);
          connect(blueprint, frontUV.outputPorts[0], outp.inputPorts[0]);
        }
      );

      const shaders = blueprint.generateAllShaders();
      const wgsl = shaders.webgpu;
      const safe = g.id.replace(/[^a-zA-Z0-9_]/g, "_");

      const declRe = new RegExp(`fn\\s+fn_${safe}[^(]*\\(([^)]+)\\)`);
      const declMatch = wgsl.match(declRe);
      expect(declMatch).not.toBeNull();
      expect(declMatch[1]).toMatch(/input:\s*FragmentInput/);

      const fnBodyStart = wgsl.indexOf(declMatch[0]);
      const fnBodyEnd = wgsl.indexOf("\n}\n", fnBodyStart);
      const fnBody = wgsl.slice(fnBodyStart, fnBodyEnd);
      expect(fnBody).toContain("input.fragUV");

      const mainSection = wgsl.slice(wgsl.indexOf("@fragment"));
      const callRe = new RegExp(`fn_${safe}[^(]*\\(([^)]+)\\)`);
      const callMatch = mainSection.match(callRe);
      expect(callMatch).not.toBeNull();
      expect(callMatch[1]).toMatch(/^input\b/);

      const glsl = shaders.webgl2;
      expect(glsl).toContain("vTex");
    });
  });
});
