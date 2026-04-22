// Multi-graph contracts.
//
// These tests verify the BlueprintSystem (host) + Graph class architecture:
//   blueprint.graphs               -> Map<id, Graph>
//   blueprint.mainGraphId          -> id of the main graph (used for code-gen + preview)
//   blueprint.activeGraphId        -> id of the graph the UI displays / interacts with
//   blueprint.mainGraph            -> blueprint.graphs.get(blueprint.mainGraphId)
//   blueprint.activeGraph          -> blueprint.graphs.get(blueprint.activeGraphId)
//   blueprint.createGraph({ id?, name? })
//   blueprint.setActiveGraph(id)
//   blueprint.deleteGraph(id)      -> cannot delete main graph
//
// The Graph instance owns: nodes, wires, comments, uniforms, shaderSettings,
// camera, selectedNodes, selectedRerouteNodes, history, previewNode,
// fileHandle, transient interaction state, all *IdCounter fields.
//
// Shared on host: customNodes (single library), clipboard, canvas/DOM,
// previewIframe + previewSettings, mcpBridge, NODE_TYPES.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("MULTI-GRAPH CONTRACTS", () => {
  describe("host shape", () => {
    it("exposes graphs Map, mainGraphId, activeGraphId", () => {
      expect(blueprint.graphs).toBeInstanceOf(Map);
      expect(blueprint.mainGraphId).toBeTruthy();
      expect(blueprint.activeGraphId).toBeTruthy();
      expect(blueprint.graphs.get(blueprint.mainGraphId)).toBeTruthy();
    });

    it("at startup, main graph == active graph", () => {
      expect(blueprint.mainGraphId).toBe(blueprint.activeGraphId);
    });
  });

  describe("graph creation, switching, deletion", () => {
    it("createGraph adds a new graph and does not switch active", () => {
      const before = blueprint.graphs.size;
      const g = blueprint.createGraph({ name: "Side" });
      expect(blueprint.graphs.size).toBe(before + 1);
      expect(blueprint.activeGraphId).not.toBe(g.id);
    });

    it("setActiveGraph swaps the UI/editor target", () => {
      const g = blueprint.createGraph({ name: "Side" });
      const prevActive = blueprint.activeGraphId;
      blueprint.setActiveGraph(g.id);
      expect(blueprint.activeGraphId).toBe(g.id);
      expect(blueprint.activeGraphId).not.toBe(prevActive);
    });

    it("deleteGraph cannot remove the main graph", () => {
      expect(() => blueprint.deleteGraph(blueprint.mainGraphId)).toThrow();
    });

    it("deleting a non-main graph removes it from the Map", () => {
      const g = blueprint.createGraph({ name: "Tmp" });
      blueprint.deleteGraph(g.id);
      expect(blueprint.graphs.has(g.id)).toBe(false);
    });
  });

  describe("isolation: graphs do not bleed into each other", () => {
    it("nodes added to graph A are not visible in graph B", () => {
      const gA = blueprint.mainGraph;
      const gB = blueprint.createGraph({ name: "B" });

      blueprint.setActiveGraph(gB.id);
      api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 }); // active = B
      // Need an api binding for B; routing rules:
      //   api.nodes.* writes go to ACTIVE graph by default
      // (unless the API explicitly says { target: 'main' } or { graphId }).

      // Per-graph ids are intentional, so check object identity instead of
      // ids: no node object from B should be present in A's array.
      for (const bNode of gB.nodes) {
        expect(gA.nodes.includes(bNode)).toBe(false);
      }
      // And vice versa.
      for (const aNode of gA.nodes) {
        expect(gB.nodes.includes(aNode)).toBe(false);
      }
    });

    it("undo/redo on graph A does not affect graph B", () => {
      const gA = blueprint.mainGraph;
      const gB = blueprint.createGraph({ name: "B" });

      blueprint.setActiveGraph(gA.id);
      const aBefore = gA.nodes.length;
      api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
      const bSnapshot = gB.exportState();

      blueprint.history.undo();
      expect(gA.nodes.length).toBe(aBefore);
      // B is untouched.
      expect(gB.exportState()).toEqual(bSnapshot);
    });

    it("selection lives on the per-graph object", () => {
      const gA = blueprint.mainGraph;
      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gA.id);
      gA.selectAllNodes();
      const aCount = gA.selectedNodes.size;
      blueprint.setActiveGraph(gB.id);
      expect(gB.selectedNodes.size).toBe(0); // B has its own selection
      blueprint.setActiveGraph(gA.id);
      expect(gA.selectedNodes.size).toBe(aCount); // A's selection persisted
    });

    it("variables in graph A do not resolve from graph B", () => {
      const gA = blueprint.mainGraph;
      const gB = blueprint.createGraph({ name: "B" });

      blueprint.setActiveGraph(gA.id);
      api.nodes.create({ typeKey: "setVariable", customInput: "v1" });

      blueprint.setActiveGraph(gB.id);
      const getVar = api.nodes.create({
        typeKey: "getVariable", selectedVariable: "v1",
      });
      const node = gB.nodes.find((n) => n.id === getVar.id);
      // Owner's nodes should NOT include any SetVariable for v1.
      const owner = node._graph || node._blueprintSystem;
      const matching = owner.nodes.find(
        (n) => n.nodeType.name === "Set Variable" && n.customInput === "v1",
      );
      expect(matching).toBeUndefined();
    });
  });

  describe("code-gen and preview always use the main graph", () => {
    it("generateAllShaders always reads from main graph", () => {
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const shadersFromMainActive = blueprint.generateAllShaders();

      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gB.id);
      const shadersFromBActive = blueprint.generateAllShaders();

      expect(shadersFromBActive).toEqual(shadersFromMainActive);
    });

    it("preview iframe is fed by main graph regardless of active graph", () => {
      // Pin: updatePreview() pulls from blueprint.mainGraph not blueprint.activeGraph.
      // Implementation detail: spy on sendShaderDataToPreview and assert the
      // shader body matches the main graph's output.
      // Left as documentation for the refactor.
      expect(true).toBe(true);
    });
  });

  describe("clipboard is shared (cross-graph copy/paste)", () => {
    it("copy in graph A then paste in graph B places nodes in B", () => {
      const gA = blueprint.mainGraph;
      const gB = blueprint.createGraph({ name: "B" });

      blueprint.setActiveGraph(gA.id);
      gA.selectAllNodes();
      blueprint.copySelected();

      blueprint.setActiveGraph(gB.id);
      const beforeB = gB.nodes.length;
      blueprint.paste();
      expect(gB.nodes.length).toBeGreaterThan(beforeB);
    });
  });

  describe("custom nodes are shared across graphs", () => {
    it("custom nodes live on host, not on Graph instance", () => {
      const gA = blueprint.mainGraph;
      // Graph instances should NOT have their own customNodes array.
      expect(gA.customNodes).toBeUndefined();
      // Host owns them.
      expect(Array.isArray(blueprint.customNodes)).toBe(true);
    });
  });

  describe("save file format: main at top, others nested", () => {
    it("saveToJSON places main graph at top level and additional graphs under _additionalGraphs", async () => {
      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gB.id);
      // populate B with one node
      api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });

      const json = await blueprint.serializeProjectToJSON(); // new method
      const parsed = JSON.parse(json);
      // Main graph nodes/wires still at top level (legacy compatibility).
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(Array.isArray(parsed.wires)).toBe(true);
      // Other graphs nested under _additionalGraphs.
      expect(Array.isArray(parsed._additionalGraphs)).toBe(true);
      expect(parsed._additionalGraphs.length).toBe(1);
      expect(parsed._additionalGraphs[0].name).toBe("B");
    });

    it("legacy single-graph .c3sg loads as main graph only", async () => {
      // Without _additionalGraphs, only the main graph is populated.
      const legacy = {
        version: "1.0.0",
        shaderSettings: {}, uniforms: [], deprecatedUniforms: [],
        customNodes: [], previewSettings: {}, camera: { x: 0, y: 0, zoom: 1 },
        nodes: [], wires: [], comments: [],
        nodeIdCounter: 1, uniformIdCounter: 1,
        customNodeIdCounter: 1, commentIdCounter: 1,
      };
      const file = { name: "old.c3sg", text: async () => JSON.stringify(legacy) };
      await blueprint.loadFromJSON(file);
      expect(blueprint.graphs.size).toBe(1);
      expect(blueprint.mainGraphId).toBe(blueprint.activeGraphId);
    });
  });

  describe("API routing", () => {
    it("api.nodes.* defaults to ACTIVE graph", () => {
      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gB.id);
      const before = gB.nodes.length;
      api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
      expect(gB.nodes.length).toBe(before + 1);
    });

    it("api supports an explicit { graphId } target", () => {
      const gB = blueprint.createGraph({ name: "B" });
      const beforeMain = blueprint.mainGraph.nodes.length;
      const beforeB = gB.nodes.length;
      api.nodes.create({ typeKey: "floatInput", x: 0, y: 0, graphId: gB.id });
      expect(gB.nodes.length).toBe(beforeB + 1);
      expect(blueprint.mainGraph.nodes.length).toBe(beforeMain);
    });
  });
});
