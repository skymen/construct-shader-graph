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

  describe("loop body round-trip", () => {
    it("preserves loopBody kind, color, contract roles, and notes", async () => {
      const g = blueprint.createLoopBodyGraph({
        name: "SumLoop",
        color: "#e67e22",
      });
      g.data.contract = {
        inputs: [{ id: "a1", name: "acc", type: "float", role: "acc" }, { id: "a2", name: "step", type: "float", role: "arg" }],
        outputs: [{ id: "a1", name: "acc", type: "float" }],
      };
      g.data.notes = "sums values";
      blueprint.syncContractCallers(g);

      const json = blueprint.serializeProjectToJSON();
      blueprint.createNewFile();
      await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

      const reloaded = [...blueprint.graphs.values()].find((gr) => gr.name === "SumLoop");
      expect(reloaded).toBeDefined();
      expect(reloaded.kind).toBe("loopBody");
      expect(reloaded.color).toBe("#e67e22");
      expect(reloaded.data.contract.inputs[0].role).toBe("acc");
      expect(reloaded.data.contract.inputs[1].role).toBe("arg");
      expect(reloaded.data.contract.outputs[0].id).toBe("a1");
      expect(reloaded.data.notes).toBe("sums values");
    });
  });

  describe("mixed function + loopBody round-trip", () => {
    it("preserves both kinds in the same project", async () => {
      const fn = blueprint.createFunctionGraph({ name: "FnA", color: "#ff0000" });
      fn.data.contract = {
        inputs: [{ id: "f1", name: "x", type: "float" }],
        outputs: [{ id: "f2", name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(fn);

      const loop = blueprint.createLoopBodyGraph({ name: "LoopB", color: "#00ff00" });
      loop.data.contract = {
        inputs: [{ id: "l1", name: "sum", type: "vec3", role: "acc" }],
        outputs: [{ id: "l1", name: "sum", type: "vec3" }],
      };
      blueprint.syncContractCallers(loop);

      const json = blueprint.serializeProjectToJSON();
      blueprint.createNewFile();
      await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

      expect(blueprint.graphs.size).toBe(3); // main + fn + loop

      const reFn = [...blueprint.graphs.values()].find((g) => g.name === "FnA");
      const reLoop = [...blueprint.graphs.values()].find((g) => g.name === "LoopB");
      expect(reFn).toBeDefined();
      expect(reFn.kind).toBe("function");
      expect(reFn.color).toBe("#ff0000");
      expect(reLoop).toBeDefined();
      expect(reLoop.kind).toBe("loopBody");
      expect(reLoop.color).toBe("#00ff00");

      const callable = blueprint.getCallableGraphs();
      expect(callable.length).toBe(2);
    });
  });

  describe("undo/redo for contract edits", () => {
    it("exportState includes contract data for function graphs", () => {
      const g = blueprint.createFunctionGraph({ name: "UndoFn" });
      g.data.contract = {
        inputs: [{ id: "u1", name: "a", type: "float" }],
        outputs: [{ id: "u2", name: "b", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      const state = blueprint.exportState();
      expect(state.data).toBeDefined();
      expect(state.data.contract.inputs[0].name).toBe("a");
      expect(state.contractVersion).toBeGreaterThan(0);
    });

    it("undo restores previous contract state on the function graph", () => {
      const g = blueprint.createFunctionGraph({ name: "UndoTest" });
      g.data.contract = {
        inputs: [{ id: "u1", name: "original", type: "float" }],
        outputs: [{ id: "u2", name: "out", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      // Re-snapshot so the history knows the current state
      g.history.currentState = blueprint.exportState();

      // Edit the contract
      g.data.contract.inputs[0].name = "modified";
      blueprint.syncContractCallers(g);

      expect(g.data.contract.inputs[0].name).toBe("modified");

      // Undo should restore the original name
      const result = g.history.undo();
      expect(result).toBeTruthy();
      expect(g.data.contract.inputs[0].name).toBe("original");
    });

    it("redo re-applies the contract change", () => {
      const g = blueprint.createFunctionGraph({ name: "RedoTest" });
      g.data.contract = {
        inputs: [{ id: "r1", name: "before", type: "float" }],
        outputs: [{ id: "r2", name: "out", type: "float" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(g.id);
      g.history.currentState = blueprint.exportState();

      g.data.contract.inputs[0].name = "after";
      blueprint.syncContractCallers(g);

      g.history.undo();
      expect(g.data.contract.inputs[0].name).toBe("before");

      g.history.redo();
      expect(g.data.contract.inputs[0].name).toBe("after");
    });

    it("multi-graph transaction: undo on affected graph rolls back caller changes", () => {
      const fn = blueprint.createFunctionGraph({ name: "TxFn" });
      fn.data.contract = {
        inputs: [{ id: "t1", name: "x", type: "float" }],
        outputs: [{ id: "t2", name: "y", type: "float" }],
      };
      blueprint.syncContractCallers(fn);

      // Place a caller in main
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${fn.id}`];
      const callerNode = blueprint.addNode(0, 0, callerType);

      // Snapshot main graph history baseline
      const mainGraph = blueprint.mainGraph;
      mainGraph.history.currentState = blueprint._exportGraphState(mainGraph);

      const callerCountBefore = callerNode.inputPorts.length;

      // Edit the function contract: add a second input
      fn.data.contract.inputs.push({ id: "t3", name: "z", type: "vec3" });
      blueprint.syncContractCallers(fn);

      // Caller should have been rebuilt with the new port
      const updatedCaller = mainGraph.nodes.find(
        (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
      );
      expect(updatedCaller.inputPorts.length).toBe(callerCountBefore + 1);

      // Undo on main graph should restore the caller to its previous port count
      const undoResult = mainGraph.history.undo();
      expect(undoResult).toBeTruthy();

      const restoredCaller = mainGraph.nodes.find(
        (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
      );
      expect(restoredCaller.inputPorts.length).toBe(callerCountBefore);
    });
  });

  describe("backward compatibility", () => {
    it("missing kind defaults to function for additional graphs", async () => {
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
            id: "old_fn",
            name: "OldFn",
            // no kind field
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

      const g = blueprint.graphs.get("old_fn");
      expect(g).toBeDefined();
      expect(g.kind).toBe("function");
      expect(g.data).toBeDefined();
      expect(g.data.contract).toBeDefined();
    });
  });
});
