// Test 17: Save/load round-trip for projects with function graphs.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function fakeFile(json) {
  return { name: "test.c3sg", text: async () => JSON.stringify(json) };
}

describe("Save/load round-trip with function graphs", () => {
  describe("serialization", () => {
    it("function graphs appear in _additionalGraphs with kind, color, data, contractVersion", () => {
      const g = blueprint.createFunctionGraph({
        name: "MyFn",
        color: "#aabbcc",
      });
      g.data.contract = {
        inputs: [{ id: 1, name: "t", type: "float" }],
        outputs: [{ id: 2, name: "r", type: "vec3" }],
      };
      g.data.notes = "a test function";
      blueprint.syncContractCallers(g);

      const json = blueprint.serializeProjectToJSON();
      const parsed = JSON.parse(json);

      const saved = parsed._additionalGraphs?.find((ag) => ag.name === "MyFn");
      expect(saved).toBeDefined();
      expect(saved.kind).toBe("function");
      expect(saved.color).toBe("#aabbcc");
      expect(saved.data.contract.inputs[0].name).toBe("t");
      expect(saved.data.contract.outputs[0].name).toBe("r");
      expect(saved.data.notes).toBe("a test function");
      expect(typeof saved.contractVersion).toBe("number");
    });

    it("FunctionCall nodes in main graph are serialized with function_call_<id> key", () => {
      const g = blueprint.createFunctionGraph({ name: "SerFn" });
      g.data.contract = {
        inputs: [{ id: 1, name: "x", type: "float" }],
        outputs: [{ id: 2, name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${g.id}`];
      blueprint.setActiveGraph(blueprint.mainGraphId);
      blueprint.addNode(0, 0, callerType);

      const json = blueprint.serializeProjectToJSON();
      const parsed = JSON.parse(json);

      const callerSaved = parsed.nodes?.find((n) =>
        n.nodeTypeKey === `function_call_${g.id}`
      );
      expect(callerSaved).toBeDefined();
    });
  });

  describe("deserialization", () => {
    it("loads a project with function graphs and restores kind/contract", async () => {
      const payload = {
        version: "1.0.0",
        shaderSettings: {},
        uniforms: [],
        deprecatedUniforms: [],
        uniformIdCounter: 1,
        customNodes: [],
        previewSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        wires: [],
        comments: [],
        nodeIdCounter: 1,
        commentIdCounter: 1,
        _additionalGraphs: [
          {
            id: "fn_abc",
            name: "LoadedFn",
            kind: "function",
            color: "#123456",
            data: {
              contract: {
                inputs: [{ id: "p1", name: "speed", type: "float" }],
                outputs: [{ id: "p2", name: "pos", type: "vec2" }],
              },
              notes: "loaded note",
            },
            contractVersion: 3,
            shaderSettings: {},
            camera: { x: 0, y: 0, zoom: 1 },
            nodes: [],
            wires: [],
            comments: [],
            nodeIdCounter: 1,
            commentIdCounter: 1,
          },
        ],
      };

      await blueprint.loadFromJSON(fakeFile(payload));

      expect(blueprint.graphs.size).toBe(2);
      const fn = blueprint.graphs.get("fn_abc");
      expect(fn).toBeDefined();
      expect(fn.kind).toBe("function");
      expect(fn.color).toBe("#123456");
      expect(fn.data.contract.inputs[0].name).toBe("speed");
      expect(fn.data.contract.outputs[0].name).toBe("pos");
      expect(fn.data.notes).toBe("loaded note");
      expect(fn.contractVersion).toBe(3);
    });

    it("caller nodes resync after loading: getNodeTypeFromKey rebuilds caller type", async () => {
      const payload = {
        version: "1.0.0",
        shaderSettings: {},
        uniforms: [],
        deprecatedUniforms: [],
        uniformIdCounter: 1,
        customNodes: [],
        previewSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [
          {
            nodeTypeKey: "function_call_fn_xyz",
            id: 99,
            x: 100,
            y: 100,
            inputPorts: [],
            outputPorts: [],
          },
        ],
        wires: [],
        comments: [],
        nodeIdCounter: 100,
        commentIdCounter: 1,
        _additionalGraphs: [
          {
            id: "fn_xyz",
            name: "XyzFn",
            kind: "function",
            color: null,
            data: {
              contract: {
                inputs: [{ id: "p1", name: "a", type: "float" }],
                outputs: [{ id: "p2", name: "b", type: "vec3" }],
              },
              notes: "",
            },
            contractVersion: 1,
            shaderSettings: {},
            camera: { x: 0, y: 0, zoom: 1 },
            nodes: [],
            wires: [],
            comments: [],
            nodeIdCounter: 1,
            commentIdCounter: 1,
          },
        ],
      };

      await blueprint.loadFromJSON(fakeFile(payload));

      // The caller node should have been loaded; its nodeType should resolve via getNodeTypeFromKey
      const callerNode = blueprint.mainGraph.nodes.find((n) =>
        blueprint.getNodeTypeKey(n.nodeType) === "function_call_fn_xyz"
      );
      expect(callerNode).toBeDefined();
      expect(callerNode.nodeType.isFunctionCall).toBe(true);
      expect(callerNode.nodeType.targetGraphId).toBe("fn_xyz");
    });

    it("round-trip preserves body wires (boundary ports get rebuilt from contract)", async () => {
      // Build a function with a body wire: FunctionInput.value -> FunctionOutput.result
      const g = blueprint.createFunctionGraph({ name: "Body" });
      g.data.contract = {
        inputs: [{ id: "b_in", name: "x", type: "float" }],
        outputs: [{ id: "b_out", name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(g);
      blueprint.setActiveGraph(g.id);
      const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      const Wire = globalThis.__sgWire;
      const w = new Wire(inp.outputPorts[0], outp.inputPorts[0]);
      inp.outputPorts[0].connections.push(w);
      outp.inputPorts[0].connections.push(w);
      g.wires.push(w);

      const json = blueprint.serializeProjectToJSON();
      blueprint.createNewFile();
      await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

      const reloaded = [...blueprint.graphs.values()].find((gr) => gr.name === "Body");
      expect(reloaded).toBeDefined();
      // Boundary nodes must have their contract-driven ports back.
      const rInp = reloaded.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
      const rOutp = reloaded.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
      expect(rInp.outputPorts.length).toBe(1);
      expect(rOutp.inputPorts.length).toBe(1);
      // And the body wire must have survived load.
      expect(reloaded.wires.length).toBe(1);
      expect(rInp.outputPorts[0].connections.length).toBe(1);
      expect(rOutp.inputPorts[0].connections.length).toBe(1);
    });

    it("round-trip preserves contract intact", async () => {
      // Create, serialize, reload, verify.
      const g = blueprint.createFunctionGraph({ name: "RT" });
      g.data.contract = {
        inputs: [{ id: "i1", name: "alpha", type: "float" }],
        outputs: [{ id: "o1", name: "beta", type: "vec2" }],
      };
      g.data.notes = "round-trip test";
      blueprint.syncContractCallers(g);

      const json = blueprint.serializeProjectToJSON();
      blueprint.createNewFile();
      await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

      const reloaded = [...blueprint.graphs.values()].find((gr) => gr.name === "RT");
      expect(reloaded).toBeDefined();
      expect(reloaded.data.contract.inputs[0].name).toBe("alpha");
      expect(reloaded.data.contract.outputs[0].name).toBe("beta");
      expect(reloaded.data.notes).toBe("round-trip test");
    });
  });

  describe("getCallableGraphs after load", () => {
    it("loaded function graphs appear in getCallableGraphs()", async () => {
      const payload = {
        version: "1.0.0",
        shaderSettings: {},
        uniforms: [],
        deprecatedUniforms: [],
        uniformIdCounter: 1,
        customNodes: [],
        previewSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        wires: [],
        comments: [],
        nodeIdCounter: 1,
        commentIdCounter: 1,
        _additionalGraphs: [
          {
            id: "callable_1",
            name: "CallableA",
            kind: "function",
            color: null,
            data: { contract: { inputs: [], outputs: [] }, notes: "" },
            contractVersion: 0,
            shaderSettings: {},
            camera: { x: 0, y: 0, zoom: 1 },
            nodes: [],
            wires: [],
            comments: [],
            nodeIdCounter: 1,
            commentIdCounter: 1,
          },
        ],
      };

      await blueprint.loadFromJSON(fakeFile(payload));

      const callable = blueprint.getCallableGraphs();
      expect(callable.some((g) => g.id === "callable_1")).toBe(true);
    });
  });
});
