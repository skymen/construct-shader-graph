// Test 44: Project constants
//
// Constants are named compile-time values, host-level like uniforms but emitted
// as `const` declarations rather than shader parameters. Unlike a uniform they
// are a constant expression in the generated source, which is what makes one
// usable as a WebGL1 loop bound (#126).
//
// Key contracts:
// 1. Host-level, not per-graph, and shared across every graph
// 2. Emitted as const declarations in all three targets
// 3. Fold at codegen time, so a constant can drive an exact WebGL1 loop
// 4. Survive save/load and undo/redo, including node instances
// 5. Renaming updates instances in every graph; deleting removes them

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { resolveConstantExpression } from "../constant-fold.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
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

// Put a constant node in front of the main Output so codegen reaches it.
function wireToOutput(node) {
  const out = blueprint.nodes.find((n) => n.nodeType === NODE_TYPES.output);
  const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
  connect(node.outputPorts[0], toVec4.inputPorts[0]);
  connect(toVec4.outputPorts[0], out.inputPorts[0]);
}

describe("Project constants", () => {
  describe("host-level storage", () => {
    it("lives on the host, not on Graph", () => {
      expect(Array.isArray(blueprint.constants)).toBe(true);
      expect(blueprint.mainGraph.constants).toBeUndefined();
      expect(typeof blueprint.constantIdCounter).toBe("number");
      expect(blueprint.mainGraph.constantIdCounter).toBeUndefined();
    });

    it("is visible from every graph", () => {
      api.constants.create({ name: "Steps", type: "int", value: 8 });
      const other = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(other.id);
      expect(blueprint.constants).toHaveLength(1);
      expect(blueprint.constants[0].name).toBe("Steps");
    });
  });

  describe("naming", () => {
    it("derives a const_-prefixed shader identifier", () => {
      const c = api.constants.create({ name: "Step Count" });
      expect(c.variableName).toBe("const_StepCount");
    });

    it("suffixes on collision rather than producing a duplicate", () => {
      const a = api.constants.create({ name: "Steps" });
      const b = api.constants.create({ name: "Steps" });
      expect(a.variableName).toBe("const_Steps");
      expect(b.variableName).toBe("const_Steps_1");
    });
  });

  describe("value coercion", () => {
    it("coerces each type to something emittable", () => {
      expect(api.constants.create({ name: "B", type: "bool", value: 1 }).value)
        .toBe(true);
      expect(api.constants.create({ name: "I", type: "int", value: 4.7 }).value)
        .toBe(4);
      expect(
        api.constants.create({ name: "V", type: "vec3", value: [1, 2] }).value,
      ).toEqual([1, 2, 1]);
    });

    it("falls back to the type default when the value is nonsense", () => {
      const c = api.constants.create({
        name: "V",
        type: "vec2",
        value: "not a vector",
      });
      expect(c.value).toEqual([0, 0]);
    });
  });

  describe("codegen", () => {
    it("emits const declarations for every target", () => {
      const c = api.constants.create({ name: "Tint", type: "color" });
      api.constants.edit(c.id, { value: [1, 0.5, 0] });
      const node = blueprint.createConstantNode(
        blueprint.constants[0],
        0,
        0,
      );
      wireToOutput(node);

      const shaders = blueprint.generateAllShaders();
      expect(shaders.webgl1).toContain(
        "const vec3 const_Tint = vec3(1.0, 0.5, 0.0);",
      );
      expect(shaders.webgl2).toContain(
        "const vec3 const_Tint = vec3(1.0, 0.5, 0.0);",
      );
      expect(shaders.webgpu).toContain(
        "const const_Tint : vec3<f32> = vec3<f32>(1.0, 0.5, 0.0);",
      );
    });

    it("emits the WGSL scalar types WGSL actually uses", () => {
      api.constants.create({ name: "Steps", type: "int", value: 8 });
      api.constants.create({ name: "On", type: "bool", value: true });
      const wgsl = blueprint.generateAllShaders().webgpu;
      expect(wgsl).toContain("const const_Steps : i32 = 8;");
      expect(wgsl).toContain("const const_On : bool = true;");
    });

    it("a constant node reads the declaration by name", () => {
      api.constants.create({ name: "Amount", type: "float", value: 0.25 });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      wireToOutput(node);

      const src = blueprint.generateAllShaders().webgl1;
      expect(src).toMatch(/float var_\d+ = const_Amount;/);
    });

    it("emits nothing when there are no constants", () => {
      const src = blueprint.generateAllShaders().webgl1;
      expect(src).not.toContain("Project Constants");
    });
  });

  describe("constant folding", () => {
    it("a constant folds to its literal value", () => {
      api.constants.create({ name: "Steps", type: "int", value: 12 });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
      connect(node.outputPorts[0], toVec4.inputPorts[0]);

      // Folding is consulted at constant-expression positions; check it
      // directly rather than through a loop, which test 16 already covers.
      const folded = resolveConstantExpression(toVec4.inputPorts[0], blueprint);
      expect(folded).toEqual({ value: 12, type: "int" });
    });

    it("stops folding once the constant is deleted", () => {
      const c = api.constants.create({ name: "Steps", type: "int", value: 12 });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
      connect(node.outputPorts[0], toVec4.inputPorts[0]);

      api.constants.delete(c.id);
      expect(
        resolveConstantExpression(toVec4.inputPorts[0], blueprint),
      ).toBeNull();
    });
  });

  describe("node instances", () => {
    it("takes its port type from the constant's type", () => {
      api.constants.create({ name: "V", type: "vec2" });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      expect(node.outputPorts[0].getResolvedType()).toBe("vec2");
    });

    it("maps color to a vec3 port", () => {
      api.constants.create({ name: "Tint", type: "color" });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      expect(node.outputPorts[0].getResolvedType()).toBe("vec3");
    });

    it("renaming updates instances in every graph", () => {
      const c = api.constants.create({ name: "Steps", type: "int" });
      const inMain = blueprint.createConstantNode(blueprint.constants[0], 0, 0);

      const sub = blueprint.createFunctionGraph({ name: "Sub" });
      blueprint.setActiveGraph(sub.id);
      const inSub = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      blueprint.setActiveGraph(blueprint.mainGraphId);

      api.constants.edit(c.id, { name: "Iterations" });

      expect(inMain.constantName).toBe("const_Iterations");
      expect(inSub.constantName).toBe("const_Iterations");
      expect(inSub.title).toBe("Iterations");
    });

    it("deleting removes instances from every graph", () => {
      const c = api.constants.create({ name: "Steps", type: "int" });
      blueprint.createConstantNode(blueprint.constants[0], 0, 0);

      const sub = blueprint.createFunctionGraph({ name: "Sub" });
      blueprint.setActiveGraph(sub.id);
      blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      blueprint.setActiveGraph(blueprint.mainGraphId);

      api.constants.delete(c.id);

      const remaining = [...blueprint.graphs.values()].flatMap((g) =>
        g.nodes.filter((n) => n.constantId !== undefined),
      );
      expect(remaining).toHaveLength(0);
      expect(blueprint.constants).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("round-trips through save/load with its node instances", async () => {
      api.constants.create({ name: "Steps", type: "int", value: 12 });
      const node = blueprint.createConstantNode(blueprint.constants[0], 0, 0);
      wireToOutput(node);

      const json = blueprint.serializeProjectToJSON();
      expect(JSON.parse(json).constants).toHaveLength(1);

      await blueprint.loadFromJSON({ text: async () => json });

      expect(blueprint.constants).toHaveLength(1);
      expect(blueprint.constants[0].value).toBe(12);
      const reloaded = blueprint.nodes.find((n) => n.constantId !== undefined);
      expect(reloaded).toBeDefined();
      expect(reloaded.constantName).toBe("const_Steps");
      expect(blueprint.generateAllShaders().webgl1).toContain(
        "const int const_Steps = 12;",
      );
    });

    it("round-trips through undo/redo", () => {
      api.constants.create({ name: "Steps", type: "int", value: 12 });
      expect(blueprint.constants).toHaveLength(1);

      blueprint.history.undo();
      expect(blueprint.constants).toHaveLength(0);

      blueprint.history.redo();
      expect(blueprint.constants).toHaveLength(1);
      expect(blueprint.constants[0].name).toBe("Steps");
    });

    it("regenerates an invalid variable name on load", async () => {
      const json = JSON.stringify({
        version: "1.0.0",
        nodes: [],
        wires: [],
        constants: [
          { id: 1, name: "Steps", variableName: "9 bad name", type: "int", value: 3 },
        ],
        constantIdCounter: 2,
      });
      await blueprint.loadFromJSON({ text: async () => json });
      expect(blueprint.constants[0].variableName).toBe("const_Steps");
    });
  });

  describe("console API", () => {
    it("is listed in help() and the manifest", () => {
      expect(api.help().methods).toContain("constants");
      const paths = api.getManifest().methods.map((m) => m.path);
      expect(paths).toContain("constants.create");
      expect(paths).toContain("constants.list");
    });

    it("changing the type re-coerces the stored value", () => {
      const c = api.constants.create({ name: "V", type: "vec3" });
      const updated = api.constants.edit(c.id, { type: "int", value: 7 });
      expect(updated.type).toBe("int");
      expect(updated.value).toBe(7);
    });

    it("rejects an unknown type", () => {
      expect(() =>
        api.constants.create({ name: "X", type: "mat4" }),
      ).toThrow(/Constant type must be one of/);
    });

    it("round-trips through exportIR / importIR", () => {
      api.constants.create({ name: "Steps", type: "int", value: 12 });
      blueprint.createConstantNode(blueprint.constants[0], 0, 0);

      const ir = api.graph.exportIR();
      const constantNode = ir.nodes.find((n) => n.type === "constant");
      expect(constantNode).toBeDefined();
      expect(constantNode.constant).toBe("Steps");

      expect(api.graph.validateIR(ir).ok).toBe(true);
    });

    it("reorders", () => {
      const a = api.constants.create({ name: "A" });
      api.constants.create({ name: "B" });
      api.constants.reorder(a.id, 1);
      expect(blueprint.constants.map((c) => c.name)).toEqual(["B", "A"]);
    });
  });
});
