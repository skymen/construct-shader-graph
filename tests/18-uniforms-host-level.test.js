// Test 18: Uniforms host-level migration
//
// Verifies that uniforms live on the host (BlueprintSystem) level, not on
// individual Graph instances. This is part of the Phase 1 scaffolding for
// the functions-and-loops feature.
//
// Key contracts:
// 1. Uniforms are accessible identically from any active graph
// 2. Adding a uniform from any tab is reflected across all graphs
// 3. Migration from old per-graph uniform location works on load
// 4. Save files write uniforms at the top level (not per-graph)

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function fakeFile(json) {
  return {
    name: "test.c3sg",
    text: async () => JSON.stringify(json),
  };
}

describe("Uniforms host-level migration", () => {
  describe("uniforms are host-level", () => {
    it("uniforms array exists on host, not on Graph", () => {
      expect(Array.isArray(blueprint.uniforms)).toBe(true);
      // Graph instances should NOT have their own uniforms array
      expect(blueprint.mainGraph.uniforms).toBeUndefined();
    });

    it("deprecatedUniforms array exists on host, not on Graph", () => {
      expect(Array.isArray(blueprint.deprecatedUniforms)).toBe(true);
      expect(blueprint.mainGraph.deprecatedUniforms).toBeUndefined();
    });

    it("uniformIdCounter exists on host, not on Graph", () => {
      expect(typeof blueprint.uniformIdCounter).toBe("number");
      expect(blueprint.mainGraph.uniformIdCounter).toBeUndefined();
    });
  });

  describe("uniforms are shared across graphs", () => {
    it("uniforms added while on main graph are visible everywhere", () => {
      blueprint.setActiveGraph(blueprint.mainGraphId);
      const uniform = {
        id: blueprint.uniformIdCounter++,
        name: "Test Uniform",
        variableName: "testUniform",
        paramId: "testUniform",
        type: "float",
        min: 0,
        max: 1,
        defaultValue: 0.5,
      };
      blueprint.uniforms.push(uniform);

      // Create another graph and switch to it
      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gB.id);

      // Uniforms should still be the same array
      expect(blueprint.uniforms).toContain(uniform);
      expect(blueprint.uniforms.length).toBe(1);
    });

    it("uniforms added from non-main graph are visible everywhere", () => {
      const gB = blueprint.createGraph({ name: "B" });
      blueprint.setActiveGraph(gB.id);

      const uniform = {
        id: blueprint.uniformIdCounter++,
        name: "Created in B",
        variableName: "createdInB",
        paramId: "createdInB",
        type: "float",
        min: 0,
        max: 1,
        defaultValue: 0.5,
      };
      blueprint.uniforms.push(uniform);

      // Switch back to main
      blueprint.setActiveGraph(blueprint.mainGraphId);

      // Uniform should be visible
      expect(blueprint.uniforms).toContain(uniform);
    });
  });

  describe("save format has uniforms at top level", () => {
    it("saved JSON has uniforms at top level, not in per-graph payloads", () => {
      // Add a uniform
      const uniform = {
        id: blueprint.uniformIdCounter++,
        name: "My Uniform",
        variableName: "myUniform",
        type: "float",
        min: 0,
        max: 1,
        defaultValue: 0.5,
      };
      blueprint.uniforms.push(uniform);

      const json = blueprint.serializeProjectToJSON();
      const parsed = JSON.parse(json);

      // Uniforms should be at top level
      expect(Array.isArray(parsed.uniforms)).toBe(true);
      expect(parsed.uniforms.length).toBe(1);
      expect(parsed.uniforms[0].name).toBe("My Uniform");
      expect(parsed.uniformIdCounter).toBeDefined();
    });

    it("additional graphs in save file do not have uniforms", () => {
      // Create additional graph
      const gB = blueprint.createGraph({ name: "B" });

      const json = blueprint.serializeProjectToJSON();
      const parsed = JSON.parse(json);

      // _additionalGraphs should exist (since we have graph B)
      expect(Array.isArray(parsed._additionalGraphs)).toBe(true);
      expect(parsed._additionalGraphs.length).toBe(1);

      // Additional graph should NOT have uniforms (they're at top level only)
      const graphB = parsed._additionalGraphs[0];
      expect(graphB.uniforms).toBeUndefined();
      expect(graphB.deprecatedUniforms).toBeUndefined();
      expect(graphB.uniformIdCounter).toBeUndefined();
    });
  });

  describe("load migration: old format with per-graph uniforms", () => {
    it("loads uniforms from top level when present", async () => {
      const payload = {
        version: "1.0.0",
        shaderSettings: {},
        uniforms: [
          { id: 1, name: "Top Level", variableName: "topLevel", type: "float", min: 0, max: 1, defaultValue: 0.5 },
        ],
        deprecatedUniforms: [],
        uniformIdCounter: 2,
        customNodes: [],
        previewSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        wires: [],
        comments: [],
        nodeIdCounter: 1,
        commentIdCounter: 1,
      };

      await blueprint.loadFromJSON(fakeFile(payload));

      expect(blueprint.uniforms.length).toBe(1);
      expect(blueprint.uniforms[0].name).toBe("Top Level");
      expect(blueprint.uniformIdCounter).toBe(2);
    });

    it("loads legacy files without top-level uniforms", async () => {
      // Legacy file format: no explicit uniforms at top level, might be empty
      const payload = {
        version: "1.0.0",
        shaderSettings: {},
        customNodes: [],
        previewSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        wires: [],
        comments: [],
        nodeIdCounter: 1,
        commentIdCounter: 1,
      };

      await blueprint.loadFromJSON(fakeFile(payload));

      // Should have empty uniforms (no crash)
      expect(Array.isArray(blueprint.uniforms)).toBe(true);
      expect(blueprint.uniforms.length).toBe(0);
    });
  });

  describe("additional graph fields (kind, color, data)", () => {
    it("additional graphs save kind, color, data, contractVersion", () => {
      const gB = blueprint.createGraph({
        name: "Function B",
        kind: "function",
        color: "#ff0000",
        data: { contract: { inputs: [], outputs: [] }, notes: "test" },
        contractVersion: 1,
      });

      const json = blueprint.serializeProjectToJSON();
      const parsed = JSON.parse(json);

      const savedB = parsed._additionalGraphs.find(g => g.name === "Function B");
      expect(savedB).toBeDefined();
      expect(savedB.kind).toBe("function");
      expect(savedB.color).toBe("#ff0000");
      expect(savedB.data).toEqual({ contract: { inputs: [], outputs: [] }, notes: "test" });
      expect(savedB.contractVersion).toBe(1);
    });

    it("additional graphs load kind, color, data, contractVersion", async () => {
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
            id: "fn1",
            name: "My Function",
            kind: "function",
            color: "#00ff00",
            data: { contract: { inputs: [{ id: 1, name: "a", type: "float" }], outputs: [] }, notes: "hello" },
            contractVersion: 5,
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

      expect(blueprint.graphs.size).toBe(2); // main + fn1
      const fn1 = blueprint.graphs.get("fn1");
      expect(fn1).toBeDefined();
      expect(fn1.name).toBe("My Function");
      expect(fn1.kind).toBe("function");
      expect(fn1.color).toBe("#00ff00");
      expect(fn1.data).toEqual({ contract: { inputs: [{ id: 1, name: "a", type: "float" }], outputs: [] }, notes: "hello" });
      expect(fn1.contractVersion).toBe(5);
    });

    it("missing kind defaults to 'function' for backward compat", async () => {
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
            id: "old",
            name: "Old Graph",
            // no kind, color, data, contractVersion
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

      const old = blueprint.graphs.get("old");
      expect(old.kind).toBe("function"); // default
      expect(old.color).toBeNull();
      expect(old.data).toEqual({ contract: { inputs: [], outputs: [] }, notes: "" });
      expect(old.contractVersion).toBe(0);
    });
  });

  describe("undo/redo with host-level uniforms", () => {
    it("snapshot includes host-level uniforms", () => {
      // Add a uniform
      const uniform = {
        id: blueprint.uniformIdCounter++,
        name: "Test",
        variableName: "test",
        type: "float",
        min: 0,
        max: 1,
        defaultValue: 0.5,
      };
      blueprint.uniforms.push(uniform);

      // Export state should include uniforms
      const snapshot = blueprint.exportState();
      expect(Array.isArray(snapshot.uniforms)).toBe(true);
      expect(snapshot.uniforms.length).toBe(1);
      expect(snapshot.uniforms[0].name).toBe("Test");
    });
  });
});
