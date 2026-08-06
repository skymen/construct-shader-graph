// Save-file (.c3sg) round-trip contract.
// We bypass the File System Access API and feed loadFromJSON a fake File.
// After the refactor, the .c3sg shape will get an `_additionalGraphs` key for
// non-main graphs, but the main graph fields must remain at the top level so
// legacy files keep loading.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { makeDefaultPreviewSettings } from "../preview-settings.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// Build the same payload shape that saveToJSON produces, without invoking the
// File picker / screenshot pipeline.
function buildSavePayload(bp) {
  return {
    version: "1.0.0",
    previewScreenshot: null,
    shaderSettings: bp.shaderSettings,
    uniforms: bp.uniforms,
    deprecatedUniforms: bp.deprecatedUniforms,
    customNodes: bp.customNodes,
    previewSettings: bp.previewSettings,
    camera: { x: bp.camera.x, y: bp.camera.y, zoom: bp.camera.zoom },
    nodes: bp.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      nodeTypeKey: bp.getNodeTypeKey(node.nodeType),
      title: node.title,
      operation: node.operation,
      customInput: node.customInput,
      data: bp.cloneNodeData(node.data),
      selectedVariable: node.selectedVariable,
      uniformName: node.uniformName,
      uniformDisplayName: node.uniformDisplayName,
      uniformVariableName: node.uniformVariableName,
      uniformId: node.uniformId,
      isVariable: node.isVariable,
      inputPorts: node.inputPorts.map((p) => ({
        name: p.name, portType: p.portType, value: p.value,
      })),
      outputPorts: node.outputPorts.map((p) => ({
        name: p.name, portType: p.portType,
      })),
    })),
    wires: bp.wires.map((wire) => ({
      startNodeId: wire.startPort.node.id,
      startPortIndex: wire.startPort.node.outputPorts.indexOf(wire.startPort),
      endNodeId: wire.endPort.node.id,
      endPortIndex: wire.endPort.node.inputPorts.indexOf(wire.endPort),
      rerouteNodes: wire.rerouteNodes.map((rn) => ({ x: rn.x, y: rn.y })),
    })),
    comments: bp.comments.map((c) => ({
      id: c.id, x: c.x, y: c.y, width: c.width, height: c.height,
      title: c.title, description: c.description, color: c.color,
    })),
    nodeIdCounter: bp.nodeIdCounter,
    uniformIdCounter: bp.uniformIdCounter,
    customNodeIdCounter: bp.customNodeIdCounter,
    commentIdCounter: bp.commentIdCounter,
  };
}

function fakeFile(json) {
  return {
    name: "test.c3sg",
    text: async () => JSON.stringify(json),
  };
}

describe(".c3sg save/load round-trip", () => {
  it("default graph loads back to identical node/wire counts", async () => {
    blueprint.addDefaultNodes(); // adds another set on top of createNewFile defaults
    blueprint.shaderSettings.name = "Test Shader";
    blueprint.shaderSettings.author = "Tester";
    const payload = buildSavePayload(blueprint);
    const expectedNodes = payload.nodes.length;
    const expectedWires = payload.wires.length;

    blueprint.createNewFile();
    // createNewFile re-adds default nodes; we just need a fresh load, not zero.
    await blueprint.loadFromJSON(fakeFile(payload));

    expect(blueprint.nodes.length).toBe(expectedNodes);
    expect(blueprint.wires.length).toBe(expectedWires);
    expect(blueprint.shaderSettings.name).toBe("Test Shader");
    expect(blueprint.shaderSettings.author).toBe("Tester");
  });

  it("camera position is restored", async () => {
    blueprint.camera.x = 123;
    blueprint.camera.y = 456;
    blueprint.camera.zoom = 1.5;
    const payload = buildSavePayload(blueprint);

    blueprint.createNewFile();
    await blueprint.loadFromJSON(fakeFile(payload));

    expect(blueprint.camera.x).toBe(123);
    expect(blueprint.camera.y).toBe(456);
    expect(blueprint.camera.zoom).toBe(1.5);
  });

  it("REFACTOR CONTRACT: a payload with extra unknown keys still loads the main graph", async () => {
    // After the Graph refactor, save format will add `_additionalGraphs: [...]`
    // alongside existing top-level fields. Legacy loaders must ignore unknown
    // keys without breaking. This test fixes that contract today.
    blueprint.addDefaultNodes();
    const payload = buildSavePayload(blueprint);
    payload._additionalGraphs = [
      { id: "g2", name: "Other graph", nodes: [], wires: [] },
    ];

    blueprint.createNewFile();
    await blueprint.loadFromJSON(fakeFile(payload));
    expect(blueprint.nodes.length).toBe(payload.nodes.length);
    expect(blueprint.wires.length).toBe(payload.wires.length);
  });
});

describe("preview settings survive a round-trip", () => {
  it("restores every stored preview setting", async () => {
    Object.assign(blueprint.previewSettings, {
      cameraMode: "perspective",
      object: "prism",
      objectScale: 2.5,
      bgOpacity: 0.4,
      startupScript: "sprite.opacity = 0.5;",
    });
    const payload = buildSavePayload(blueprint);
    const expected = { ...blueprint.previewSettings };

    blueprint.createNewFile();
    await blueprint.loadFromJSON(fakeFile(payload));

    expect(blueprint.previewSettings).toEqual(expected);
  });

  it("restores the rotation axes, the offset and the canvas size", async () => {
    Object.assign(blueprint.previewSettings, {
      objectAngle: 15,
      objectAngleX: 55,
      objectAngleY: 30,
      objectOffsetX: 25,
      objectOffsetY: -10,
      objectOffsetZ: 40,
      canvasWidth: 480,
      canvasHeight: 320,
    });
    const payload = buildSavePayload(blueprint);

    blueprint.createNewFile();
    await blueprint.loadFromJSON(fakeFile(payload));

    expect(blueprint.previewSettings).toMatchObject({
      objectAngle: 15,
      objectAngleX: 55,
      objectAngleY: 30,
      objectOffsetX: 25,
      objectOffsetY: -10,
      objectOffsetZ: 40,
      canvasWidth: 480,
      canvasHeight: 320,
    });
  });

  it("gives a file that predates the new axes their defaults", async () => {
    // A .c3sg written before 3D rotation and the resolution control names only
    // objectAngle. Everything it does not name has to come back as the default
    // that reproduces today's rendering, not as whatever was on screen.
    const payload = buildSavePayload(blueprint);
    payload.previewSettings = { objectAngle: 90 };

    await blueprint.loadFromJSON(fakeFile(payload));

    expect(blueprint.previewSettings).toEqual({
      ...makeDefaultPreviewSettings(),
      objectAngle: 90,
    });
    expect(blueprint.previewSettings.objectAngleX).toBe(0);
    expect(blueprint.previewSettings.canvasWidth).toBe(240);
  });

  it("fills a legacy payload's missing keys from the defaults, not from the previously open file", async () => {
    // The merge used to be over the *current* settings, so a setting from the
    // file you had open leaked into a file that never had one.
    blueprint.previewSettings.cameraMode = "perspective";
    blueprint.previewSettings.objectScale = 3;

    const payload = buildSavePayload(blueprint);
    payload.previewSettings = { spriteScale: 1.6 };

    await blueprint.loadFromJSON(fakeFile(payload));

    // spriteScale is the pre-merge name for objectScale.
    expect(blueprint.previewSettings).toEqual({
      ...makeDefaultPreviewSettings(),
      objectScale: 1.6,
    });
  });
});
