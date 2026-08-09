// Code generation contract.
// generateAllShaders() must produce non-empty, valid-looking shader strings for
// all three targets when an Output node is reachable. Critically, the new
// system must always invoke code-gen against the MAIN graph (not the active
// graph), so this test pins the current behavior under "single graph = main".

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
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

  it("emits SDF Gradient Color code for all shader targets", () => {
    const output = blueprint.nodes.find((node) => node.nodeType === NODE_TYPES.output);
    const circle = blueprint.addNode(0, 0, NODE_TYPES.circleSDF);
    const gradient = blueprint.addNode(0, 0, NODE_TYPES.sdfGradientColor);

    const Wire = globalThis.__sgWire;
    const sdfWire = new Wire(circle.outputPorts[0], gradient.inputPorts[0]);
    circle.outputPorts[0].connections.push(sdfWire);
    gradient.inputPorts[0].connections.push(sdfWire);
    blueprint.wires.push(sdfWire);
    blueprint.resolveGenericsForConnection(circle.outputPorts[0], gradient.inputPorts[0]);

    const outputWire = new Wire(gradient.outputPorts[0], output.inputPorts[0]);
    gradient.outputPorts[0].connections.push(outputWire);
    output.inputPorts[0].connections.push(outputWire);
    blueprint.wires.push(outputWire);
    blueprint.resolveGenericsForConnection(gradient.outputPorts[0], output.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    expect(shaders.webgl1).toContain("outlineMask_");
    expect(shaders.webgl2).toContain("innerColor_");
    expect(shaders.webgpu).toContain("vec4<f32>");
  });
});
