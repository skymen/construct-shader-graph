// Code generation contract.
// generateAllShaders() must produce non-empty, valid-looking shader strings for
// all three targets when an Output node is reachable. Critically, the new
// system must always invoke code-gen against the MAIN graph (not the active
// graph), so this test pins the current behavior under "single graph = main".

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("generateAllShaders", () => {
  it("default graph produces shaders for webgl1, webgl2, webgpu", () => {
    const shaders = blueprint.generateAllShaders();
    expect(shaders).toBeTruthy();
    expect(typeof shaders.webgl1).toBe("string");
    expect(typeof shaders.webgl2).toBe("string");
    expect(typeof shaders.webgpu).toBe("string");
    expect(shaders.webgl1.length).toBeGreaterThan(0);
    expect(shaders.webgl2.length).toBeGreaterThan(0);
    expect(shaders.webgpu.length).toBeGreaterThan(0);
  });

  it("emits some recognisable token in webgl2 output", () => {
    const shaders = blueprint.generateAllShaders();
    // Either a void main, an out color, or a precision declaration is in the boilerplate.
    expect(
      /void\s+main|precision|out\s+vec4|fragColor/.test(shaders.webgl2),
    ).toBe(true);
  });

  it("graph with no output node returns null (current contract)", () => {
    blueprint.createNewFile();
    // Wipe everything including the default Output node
    blueprint.nodes = [];
    blueprint.wires = [];
    const shaders = blueprint.generateAllShaders();
    expect(shaders).toBeNull();
  });

  it("REFACTOR CONTRACT: code-gen depends on this.nodes only (no DOM/UI)", () => {
    const shadersBefore = blueprint.generateAllShaders();
    expect(shadersBefore).toBeTruthy();

    blueprint.selectedNodes.clear();
    blueprint.camera = { x: -9999, y: -9999, zoom: 0.001 };
    const shadersAfter = blueprint.generateAllShaders();

    expect(shadersAfter.webgl1).toBe(shadersBefore.webgl1);
    expect(shadersAfter.webgl2).toBe(shadersBefore.webgl2);
    expect(shadersAfter.webgpu).toBe(shadersBefore.webgpu);
  });
});
