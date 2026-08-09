// Issues #112, #114 and #116 — host-level things that live in every graph, but
// only ever got updated in the one you happened to be looking at.
//
//   #112  editing a custom node didn't update instances elsewhere, and never
//         recomputed pill-vs-box even in the active graph
//   #114  renaming a function left every caller node showing the old name
//   #116  renaming a uniform left nodes in other graphs emitting the OLD
//         shader identifier — a wrong shader, not just a wrong label
//
// They share two causes: `this.nodes` delegates to the active graph, and a
// Node's title/isVariable/width were computed once in the constructor and never
// again (`recalculateHeight()` even bails out early on a pill).

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// Register a custom node definition directly, the way saveCustomNode would.
function defineCustomNode({ id, name, inputs, outputs, color = "#9b59b6" }) {
  const def = {
    id,
    name,
    color,
    inputs,
    outputs,
    description: "",
    code: {
      webgl1: { dependency: "", execution: "" },
      webgl2: { dependency: "", execution: "" },
      webgpu: { dependency: "", execution: "" },
    },
  };
  blueprint.customNodes.push(def);
  return def;
}

function addUniform(name, type = "float") {
  const uniform = {
    id: blueprint.uniformIdCounter++,
    paramId: blueprint.generateUniformParamId(),
    name,
    variableName: blueprint.buildUniqueUniformVariableName(name),
    description: "",
    type,
    value: type === "color" ? { r: 1, g: 1, b: 1 } : 0.0,
    isPercent: false,
    isDeprecated: false,
  };
  blueprint.uniforms.push(uniform);
  return uniform;
}

describe("CROSS-GRAPH INSTANCE SYNC (#112, #114, #116)", () => {
  describe("custom nodes (#112)", () => {
    it("recomputes pill-vs-box when the last input appears", () => {
      const def = defineCustomNode({
        id: 900,
        name: "Thing",
        inputs: [],
        outputs: [{ name: "Out", type: "float" }],
      });
      const node = blueprint.addNode(
        0,
        0,
        blueprint.createNodeTypeFromCustomNode(def),
      );

      // No inputs, one output, no widgets → pill.
      expect(node.isVariable).toBe(true);
      expect(node.height).toBe(35);

      def.inputs = [{ name: "In", type: "float" }];
      blueprint.updateCustomNodeInstances(def);

      expect(node.isVariable).toBe(false);
      expect(node.width).toBe(180);
      expect(node.height).toBeGreaterThan(35);
    });

    it("recomputes it the other way too, when the last input goes", () => {
      const def = defineCustomNode({
        id: 901,
        name: "Thing",
        inputs: [{ name: "In", type: "float" }],
        outputs: [{ name: "Out", type: "float" }],
      });
      const node = blueprint.addNode(
        0,
        0,
        blueprint.createNodeTypeFromCustomNode(def),
      );
      expect(node.isVariable).toBe(false);

      def.inputs = [];
      blueprint.updateCustomNodeInstances(def);

      expect(node.isVariable).toBe(true);
      expect(node.height).toBe(35);
    });

    it("updates instances in graphs that are not open", () => {
      const def = defineCustomNode({
        id: 902,
        name: "Thing",
        inputs: [],
        outputs: [{ name: "Out", type: "float" }],
      });

      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      blueprint.setActiveGraph(fn.id);
      const inSubgraph = blueprint.addNode(
        0,
        0,
        blueprint.createNodeTypeFromCustomNode(def),
      );

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const inMain = blueprint.addNode(
        0,
        0,
        blueprint.createNodeTypeFromCustomNode(def),
      );

      def.inputs = [{ name: "In", type: "float" }];
      def.name = "Renamed Thing";
      blueprint.updateCustomNodeInstances(def);

      for (const node of [inMain, inSubgraph]) {
        expect(node.inputPorts.length).toBe(1);
        expect(node.isVariable).toBe(false);
        expect(node.title).toBe("Renamed Thing");
        expect(node.displayTitle).toBe("Renamed Thing");
      }
    });

    it("deletes instances from every graph", () => {
      const def = defineCustomNode({
        id: 903,
        name: "Thing",
        inputs: [],
        outputs: [{ name: "Out", type: "float" }],
      });

      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      blueprint.setActiveGraph(fn.id);
      blueprint.addNode(0, 0, blueprint.createNodeTypeFromCustomNode(def));
      blueprint.setActiveGraph(blueprint.mainGraphId);
      blueprint.addNode(0, 0, blueprint.createNodeTypeFromCustomNode(def));

      blueprint.deleteCustomNode(903);

      const key = "custom_903";
      for (const graph of blueprint.graphs.values()) {
        expect(
          graph.nodes.some(
            (n) => blueprint.getNodeTypeKey(n.nodeType) === key,
          ),
        ).toBe(false);
      }
    });

    it("does not persist the derived shape to file", () => {
      const def = defineCustomNode({
        id: 904,
        name: "Thing",
        inputs: [],
        outputs: [{ name: "Out", type: "float" }],
      });
      blueprint.addNode(0, 0, blueprint.createNodeTypeFromCustomNode(def));

      const saved = JSON.parse(blueprint.serializeProjectToJSON());
      const nodeData = saved.nodes.find(
        (n) => n.nodeTypeKey === "custom_904",
      );
      expect(nodeData).toBeTruthy();
      expect("isVariable" in nodeData).toBe(false);
    });
  });

  describe("function rename (#114)", () => {
    it("renames caller nodes in every graph", () => {
      const fn = blueprint.createFunctionGraph({ name: "OldName" });
      const other = blueprint.createFunctionGraph({ name: "Other" });

      const callerType = blueprint.getNodeTypeFromKey(
        `function_call_${fn.id}`,
      );
      const inMain = blueprint.addNode(0, 0, callerType);

      blueprint.setActiveGraph(other.id);
      const inOther = blueprint.addNode(0, 0, callerType);
      blueprint.setActiveGraph(blueprint.mainGraphId);

      expect(inMain.title).toBe("OldName");

      fn.name = "NewName";
      blueprint.syncContractCallers(fn);

      for (const node of [inMain, inOther]) {
        expect(node.title).toBe("NewName");
        expect(node.displayTitle).toBe("NewName");
      }
    });

    it("caller nodes convert to and from pill when the contract empties", () => {
      // The other half of #112's title: a function with no inputs draws as a
      // pill, and adding an input has to convert every existing caller back.
      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      fn.data.contract.inputs = [];
      blueprint.syncContractCallers(fn);

      const caller = blueprint.addNode(
        0,
        0,
        blueprint.getNodeTypeFromKey(`function_call_${fn.id}`),
      );
      expect(caller.isVariable).toBe(true);
      expect(caller.height).toBe(35);

      fn.data.contract.inputs = [{ id: "p_x", name: "x", type: "float" }];
      blueprint.syncContractCallers(fn);

      expect(caller.isVariable).toBe(false);
      expect(caller.width).toBe(180);
      expect(caller.height).toBeGreaterThan(35);

      fn.data.contract.inputs = [];
      blueprint.syncContractCallers(fn);

      expect(caller.isVariable).toBe(true);
      expect(caller.height).toBe(35);
    });

    it("survives a save/load round-trip", async () => {
      const fn = blueprint.createFunctionGraph({ name: "OldName" });
      blueprint.addNode(
        0,
        0,
        blueprint.getNodeTypeFromKey(`function_call_${fn.id}`),
      );

      fn.name = "NewName";
      blueprint.syncContractCallers(fn);

      const json = blueprint.serializeProjectToJSON();
      await blueprint.loadFromJSON({ text: async () => json });

      const caller = blueprint.mainGraph.nodes.find(
        (n) => n.nodeType.isFunctionCall,
      );
      expect(caller).toBeTruthy();
      expect(caller.title).toBe("NewName");
      expect(caller.displayTitle).toBe("NewName");
    });
  });

  describe("uniform rename (#116)", () => {
    it("updates uniform nodes in graphs that are not open", () => {
      const uniform = addUniform("Amount");

      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      blueprint.setActiveGraph(fn.id);
      const inSubgraph = blueprint.createUniformNode(uniform, 0, 0);
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const inMain = blueprint.createUniformNode(uniform, 0, 0);

      const oldVariableName = uniform.variableName;
      uniform.name = "Strength";
      uniform.variableName = blueprint.buildUniqueUniformVariableName(
        "Strength",
        uniform.id,
      );
      blueprint.updateUniformNodeNames(uniform.id, oldVariableName);

      for (const node of [inMain, inSubgraph]) {
        expect(node.uniformName).toBe(uniform.variableName);
        expect(node.uniformName).not.toBe(oldVariableName);
        expect(node.uniformDisplayName).toBe("Strength");
        expect(node.title).toBe("Strength");
      }
    });

    it("finds a node whose uniformName already drifted", () => {
      // The old code matched on `node.uniformName === oldVariableName`, so a
      // node that got missed once could never be found again. Matching on
      // uniformId does not have that failure mode.
      const uniform = addUniform("Amount");
      const node = blueprint.createUniformNode(uniform, 0, 0);
      node.uniformName = "uniform_something_stale";

      uniform.name = "Strength";
      uniform.variableName = blueprint.buildUniqueUniformVariableName(
        "Strength",
        uniform.id,
      );
      blueprint.updateUniformNodeNames(uniform.id, "does_not_match");

      expect(node.uniformName).toBe(uniform.variableName);
    });

    it("removes uniform nodes from every graph on delete", () => {
      const uniform = addUniform("Amount");

      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      blueprint.setActiveGraph(fn.id);
      blueprint.createUniformNode(uniform, 0, 0);
      blueprint.setActiveGraph(blueprint.mainGraphId);
      blueprint.createUniformNode(uniform, 0, 0);

      blueprint.deleteUniform(uniform.id);

      for (const graph of blueprint.graphs.values()) {
        expect(graph.nodes.some((n) => n.uniformId === uniform.id)).toBe(false);
      }
    });
  });
});
