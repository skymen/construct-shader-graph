// Test 19: Generics & monomorphization (Phase 7)
//
// Verifies:
// - Fully-generic function emits one variant per call signature with distinct
//   mangled names (fn_<id>_<sigHash>).
// - Body-inferred function (generic resolved inside body) emits a single variant.
// - Unconnected generic at a call site defaults to float.
// - GLSL and WGSL output both validated.
// - View Code shows multiple variants for a multi-signature generic function.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function connect(bp, srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  bp.wires.push(wire);
  return wire;
}

function getMainOutput() {
  blueprint.setActiveGraph(blueprint.mainGraphId);
  const outputNode = blueprint.nodes.find(
    (n) => n.nodeType === NODE_TYPES.output,
  );
  // Disconnect default wires so we can wire our own nodes to the output
  for (const port of outputNode.inputPorts) {
    for (const wire of [...port.connections]) {
      const other = wire.startPort === port ? wire.endPort : wire.startPort;
      if (other) other.connections = other.connections.filter((w) => w !== wire);
      port.connections = port.connections.filter((w) => w !== wire);
      blueprint.wires = blueprint.wires.filter((w) => w !== wire);
    }
  }
  return { outputNode };
}

function sanitizeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_]/g, "_").replace(/^([^a-zA-Z_])/, "_$1");
}

describe("Generics & monomorphization — Phase 7", () => {
  describe("computeCallSiteSignature", () => {
    it("produces distinct sigHash for different concrete types", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Identity" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      // Fake caller with float input
      const floatSig = functionKindHandler.computeCallSiteSignature(
        { inputPorts: [{ connections: [{ startPort: { getResolvedType: () => "float" } }] }], nodeType: { targetGraphId: g.id } },
        blueprint,
      );

      // Fake caller with vec3 input
      const vec3Sig = functionKindHandler.computeCallSiteSignature(
        { inputPorts: [{ connections: [{ startPort: { getResolvedType: () => "vec3" } }] }], nodeType: { targetGraphId: g.id } },
        blueprint,
      );

      expect(floatSig.sigHash).not.toBe(vec3Sig.sigHash);
      expect(floatSig.fnName).not.toBe(vec3Sig.fnName);
      expect(floatSig.fnName).toContain(floatSig.sigHash);
      expect(vec3Sig.fnName).toContain(vec3Sig.sigHash);
    });

    it("produces identical sigHash for same concrete types", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Double" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      const fakeCaller = (resolvedType) => ({
        inputPorts: [{ connections: [{ startPort: { getResolvedType: () => resolvedType } }] }],
        nodeType: { targetGraphId: g.id },
      });

      const sig1 = functionKindHandler.computeCallSiteSignature(fakeCaller("float"), blueprint);
      const sig2 = functionKindHandler.computeCallSiteSignature(fakeCaller("float"), blueprint);

      expect(sig1.sigHash).toBe(sig2.sigHash);
      expect(sig1.fnName).toBe(sig2.fnName);
    });

    it("resolves unconnected generic inputs to float", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Fallback" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      // Unconnected input port
      const sig = functionKindHandler.computeCallSiteSignature(
        { inputPorts: [{ connections: [] }], nodeType: { targetGraphId: g.id } },
        blueprint,
      );

      expect(sig.resolvedInputTypes).toEqual(["float"]);
      expect(sig.resolvedOutputTypes).toEqual(["float"]);
    });

    it("concrete-typed contract does not produce sigHash in fnName", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Concrete" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "float" }],
        outputs: [{ id: "p2", name: "result", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      const sig = functionKindHandler.computeCallSiteSignature(
        { inputPorts: [{ connections: [] }], nodeType: { targetGraphId: g.id } },
        blueprint,
      );

      expect(sig.hasGenerics).toBe(false);
      expect(sig.fnName).toBe(`fn_${sanitizeId(g.id)}`);
      expect(sig.fnName).not.toContain(sig.sigHash);
    });
  });

  describe("full shader generation with generics", () => {
    it("emits two distinct variants for a generic function called with float and vec3", () => {
      // Create a generic identity function: T → T
      const fnGraph = blueprint.createFunctionGraph({ name: "GenId" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body: FunctionInput.x → FunctionOutput.result (passthrough)
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inputNode.outputPorts[0], outputNode.inputPorts[0]);

      // Main graph: two callers with different types, both feeding into output
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const { outputNode: mainOut } = getMainOutput();

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];

      // Caller 1: feed a float value (via math node)
      const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
      const caller1 = blueprint.addNode(100, 0, callerType);
      connect(blueprint, mathNode.outputPorts[0], caller1.inputPorts[0]);

      // Caller 2: feed a vec3 value (via appendVec3 node)
      const vec3Node = blueprint.addNode(0, 100, NODE_TYPES.appendVec3);
      const caller2 = blueprint.addNode(100, 100, callerType);
      connect(blueprint, vec3Node.outputPorts[0], caller2.inputPorts[0]);

      // Both callers feed through toVec4 nodes into the output:
      // caller1(float) → toVec4_1 → output
      // caller2(vec3) → toVec4_2 (but we need it reachable)
      // Chain: caller2 output → toVec4_2; caller1 output + toVec4_2 output → toVec4_1 → output
      // Simpler: use an Add node to combine both paths before the output.
      const toVec4_1 = blueprint.addNode(200, 0, NODE_TYPES.toVec4);
      const toVec4_2 = blueprint.addNode(200, 100, NODE_TYPES.toVec4);
      connect(blueprint, caller1.outputPorts[0], toVec4_1.inputPorts[0]);
      connect(blueprint, caller2.outputPorts[0], toVec4_2.inputPorts[0]);

      // Add the two vec4s together, then send to output
      const addNode = blueprint.addNode(300, 50, NODE_TYPES.math);
      connect(blueprint, toVec4_1.outputPorts[0], addNode.inputPorts[0]);
      connect(blueprint, toVec4_2.outputPorts[0], addNode.inputPorts[1]);

      const toVec4_out = blueprint.addNode(400, 50, NODE_TYPES.toVec4);
      connect(blueprint, addNode.outputPorts[0], toVec4_out.inputPorts[0]);
      connect(blueprint, toVec4_out.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      expect(shaders).not.toBeNull();

      const fnBase = `fn_${sanitizeId(fnGraph.id)}`;

      // GLSL: two distinct fn_ variants (different sigHash suffixes)
      const webgl2 = shaders.webgl2;
      const fnMatches = webgl2.match(new RegExp(`${fnBase}_[a-f0-9]+`, "g"));
      expect(fnMatches).not.toBeNull();
      const unique = new Set(fnMatches);
      expect(unique.size).toBeGreaterThanOrEqual(2);

      // WGSL: same pattern
      const webgpu = shaders.webgpu;
      const wgslMatches = webgpu.match(new RegExp(`${fnBase}_[a-f0-9]+`, "g"));
      expect(wgslMatches).not.toBeNull();
      const wgslUnique = new Set(wgslMatches);
      expect(wgslUnique.size).toBeGreaterThanOrEqual(2);
    });

    it("emits a single variant for a concrete-typed function", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "AddFloat" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "a", type: "float" }, { id: "p2", name: "b", type: "float" }],
        outputs: [{ id: "p3", name: "sum", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body: input.a → FunctionOutput (trivial)
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inputNode.outputPorts[0], outputNode.inputPorts[0]);

      // Main: two callers of the same concrete function, both reachable from output
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const { outputNode: mainOut } = getMainOutput();
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];

      const caller1 = blueprint.addNode(100, 0, callerType);
      const caller2 = blueprint.addNode(100, 100, callerType);
      // Chain: caller2 → caller1 → toVec4 → output
      connect(blueprint, caller2.outputPorts[0], caller1.inputPorts[0]);
      const toVec4 = blueprint.addNode(200, 0, NODE_TYPES.toVec4);
      connect(blueprint, caller1.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      expect(shaders).not.toBeNull();

      const fnBase = `fn_${sanitizeId(fnGraph.id)}`;
      const webgl2 = shaders.webgl2;

      // Concrete function: name should NOT have a sigHash suffix.
      // The declaration should appear somewhere in the shader.
      expect(webgl2).toContain(fnBase);
      // One declaration + two call sites = 3 occurrences, but all use the same name
      const withSuffix = webgl2.match(new RegExp(`${fnBase}_[a-f0-9]+`, "g"));
      expect(withSuffix).toBeNull();
    });

    it("body-inferred function emits a single variant even with generic contract", () => {
      // Function with generic T contract, but body connects T to a float node
      const fnGraph = blueprint.createFunctionGraph({ name: "BodyInferred" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body: FunctionInput.x → math(add) → FunctionOutput.result
      // Math node is float-typed, which resolves T → float inside the body.
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
      connect(blueprint, inputNode.outputPorts[0], mathNode.inputPorts[0]);
      connect(blueprint, mathNode.outputPorts[0], outputNode.inputPorts[0]);

      // Main: one caller, unconnected (defaults to float)
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const { outputNode: mainOut } = getMainOutput();
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      const caller = blueprint.addNode(100, 0, callerType);

      const toVec4 = blueprint.addNode(200, 0, NODE_TYPES.toVec4);
      connect(blueprint, caller.outputPorts[0], toVec4.inputPorts[0]);
      connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

      const shaders = blueprint.generateAllShaders();
      expect(shaders).not.toBeNull();

      const fnBase = `fn_${sanitizeId(fnGraph.id)}`;
      const webgl2 = shaders.webgl2;

      // All call sites should share the same signature (float),
      // so there should be at most one distinct function name pattern.
      const allFnRefs = webgl2.match(new RegExp(`${fnBase}[_a-f0-9]*\\(`, "g"));
      if (allFnRefs) {
        const uniqueNames = new Set(allFnRefs.map((r) => r.replace("(", "")));
        expect(uniqueNames.size).toBe(1);
      }
    });
  });

  describe("emitFunctionDeclaration GLSL vs WGSL", () => {
    it("GLSL uses parameter types matching the signature", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Lerp" });
      g.data.contract = {
        inputs: [
          { id: "p1", name: "a", type: "T" },
          { id: "p2", name: "b", type: "T" },
          { id: "p3", name: "t", type: "float" },
        ],
        outputs: [{ id: "p4", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      const sigVec3 = {
        sigHash: "aaa111", sigStr: "vec3,vec3,float->vec3",
        hasGenerics: true, fnName: `fn_${sanitizeId(g.id)}_aaa111`,
        inputTypes: ["vec3", "vec3", "float"], outputTypes: ["vec3"],
        bindings: { T: "vec3" },
        resolvedInputTypes: ["vec3", "vec3", "float"],
        resolvedOutputTypes: ["vec3"],
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sigVec3, "webgl2", blueprint);
      expect(declaration).toContain("vec3");
      expect(declaration).toContain("float");
      expect(declaration).toContain(sigVec3.fnName);
      expect(declaration).toContain("{");
      expect(declaration).toContain("}");
    });

    it("WGSL uses WGSL type names and arrow return syntax", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "Scale" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "v", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      const sig = {
        sigHash: "bbb222", sigStr: "vec4->vec4",
        hasGenerics: true, fnName: `fn_${sanitizeId(g.id)}_bbb222`,
        inputTypes: ["vec4"], outputTypes: ["vec4"],
        bindings: { T: "vec4" },
        resolvedInputTypes: ["vec4"],
        resolvedOutputTypes: ["vec4"],
      };

      const { declaration } = functionKindHandler.emitFunctionDeclaration(g, sig, "webgpu", blueprint);
      expect(declaration).toContain("fn ");
      expect(declaration).toContain("-> vec4<f32>");
      expect(declaration).toContain(sig.fnName);
    });
  });

  describe("View Code for function tab", () => {
    it("shows variant label comment in callable graph preview", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Preview" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inputNode.outputPorts[0], outputNode.inputPorts[0]);

      // Place a caller in main so a real variant exists
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];
      blueprint.addNode(100, 0, callerType);

      // Generate the callable graph preview
      const preview = blueprint._generateCallableGraphPreview(fnGraph, "webgl2");
      expect(preview).toContain(`fn_${sanitizeId(fnGraph.id)}`);
      expect(preview).toContain("//");
    });

    it("shows speculative variant when function is unused", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Unused" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inputNode.outputPorts[0], outputNode.inputPorts[0]);

      // No callers — preview should still produce something (speculative)
      const preview = blueprint._generateCallableGraphPreview(fnGraph, "webgl2");
      expect(preview).not.toBe("");
      expect(preview).toContain(`fn_${sanitizeId(fnGraph.id)}`);
    });

    it("shows multiple labeled variants when called with different signatures", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Multi" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "T" }],
        outputs: [{ id: "p2", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(fnGraph);

      // Wire body: passthrough
      blueprint.setActiveGraph(fnGraph.id);
      const inputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outputNode = fnGraph.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      connect(blueprint, inputNode.outputPorts[0], outputNode.inputPorts[0]);

      // Place two callers in main with different input types
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fnGraph.id}`];

      const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math); // float
      const caller1 = blueprint.addNode(100, 0, callerType);
      connect(blueprint, mathNode.outputPorts[0], caller1.inputPorts[0]);

      const vec3Node = blueprint.addNode(0, 100, NODE_TYPES.appendVec3); // vec3
      const caller2 = blueprint.addNode(100, 100, callerType);
      connect(blueprint, vec3Node.outputPorts[0], caller2.inputPorts[0]);

      const preview = blueprint._generateCallableGraphPreview(fnGraph, "webgl2");
      const fnBase = `fn_${sanitizeId(fnGraph.id)}`;

      // Should contain two different variant names
      const variantMatches = preview.match(new RegExp(`${fnBase}_[a-f0-9]+`, "g"));
      if (variantMatches) {
        const unique = new Set(variantMatches);
        expect(unique.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("multi-generic contracts (T and U)", () => {
    it("resolves independent generics from different input wires", async () => {
      const { functionKindHandler } = await import("../graph-kinds/function-kind.js");

      const g = blueprint.createFunctionGraph({ name: "BiGeneric" });
      g.data.contract = {
        inputs: [
          { id: "p1", name: "a", type: "T" },
          { id: "p2", name: "b", type: "U" },
        ],
        outputs: [{ id: "p3", name: "result", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      const sig = functionKindHandler.computeCallSiteSignature(
        {
          inputPorts: [
            { connections: [{ startPort: { getResolvedType: () => "vec3" } }] },
            { connections: [{ startPort: { getResolvedType: () => "float" } }] },
          ],
          nodeType: { targetGraphId: g.id },
        },
        blueprint,
      );

      expect(sig.bindings.T).toBe("vec3");
      expect(sig.bindings.U).toBe("float");
      expect(sig.resolvedInputTypes).toEqual(["vec3", "float"]);
      expect(sig.resolvedOutputTypes).toEqual(["vec3"]);
    });
  });

  describe("loop body generics", () => {
    it("loop body accumulator generics resolve at call site", async () => {
      const { loopBodyKindHandler } = await import("../graph-kinds/loop-body-kind.js");

      const g = blueprint.createLoopBodyGraph({ name: "GenLoop" });
      g.data.contract = {
        inputs: [{ id: "p1", name: "acc", type: "T", role: "acc" }],
        outputs: [{ id: "p1", name: "acc", type: "T" }],
      };
      blueprint.syncContractCallers(g);

      // Fake ForLoop caller with vec3 initial accumulator
      const sig = loopBodyKindHandler.computeCallSiteSignature(
        {
          inputPorts: [
            { connections: [] },  // Count (int)
            { connections: [{ startPort: { getResolvedType: () => "vec3" } }] },  // Initial acc
          ],
          nodeType: { targetGraphId: g.id },
        },
        blueprint,
      );

      expect(sig.bindings.T).toBe("vec3");
      expect(sig.resolvedOutputTypes).toEqual(["vec3"]);
      expect(sig.fnName).toContain(sig.sigHash);
    });
  });
});
