// Project-wide float precision (shaderSettings.floatPrecision).
//
// It rewrites the GLSL boilerplate's `precision lowp float;` line and nothing
// else, so every float declared without its own qualifier follows it. The
// default must stay lowp: every file saved before the setting existed has to
// compile byte-identically. highp is written as the boilerplate's `highmedp`
// macro, which only works because the macro is #defined above that line.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

const GLSL = ["webgl1", "webgl2"];

describe("floatPrecision", () => {
  it("defaults to lowp, the line the boilerplate has always had", () => {
    expect(blueprint.shaderSettings.floatPrecision).toBe("lowp");
    const shaders = blueprint.generateAllShaders();
    for (const target of GLSL) {
      expect(shaders[target]).toContain("precision lowp float;");
    }
  });

  it("mediump rewrites the precision line in both GLSL targets", () => {
    api.shader.updateInfo({ floatPrecision: "mediump" });
    const shaders = blueprint.generateAllShaders();
    for (const target of GLSL) {
      expect(shaders[target]).toContain("precision mediump float;");
      expect(shaders[target]).not.toContain("precision lowp float;");
    }
  });

  it("highp is emitted as highmedp, after the macro is defined", () => {
    api.shader.updateInfo({ floatPrecision: "highp" });
    const shaders = blueprint.generateAllShaders();
    for (const target of GLSL) {
      const src = shaders[target];
      const line = src.indexOf("precision highmedp float;");
      expect(line).toBeGreaterThan(-1);
      expect(src.indexOf("#define highmedp")).toBeLessThan(line);
      expect(src).not.toContain("precision lowp float;");
    }
  });

  it("leaves WebGPU untouched", () => {
    const wgsl = blueprint.generateAllShaders().webgpu;
    for (const value of ["mediump", "highp"]) {
      api.shader.updateInfo({ floatPrecision: value });
      expect(blueprint.generateAllShaders().webgpu).toBe(wgsl);
    }
  });

  it("rejects anything but lowp, mediump and highp", () => {
    expect(() => api.shader.updateInfo({ floatPrecision: "highmedp" })).toThrow(
      /floatPrecision must be one of/,
    );
    expect(blueprint.shaderSettings.floatPrecision).toBe("lowp");
  });

  it("round-trips through save data", async () => {
    api.shader.updateInfo({ floatPrecision: "mediump" });
    const saved = api.projects.getSaveData();
    blueprint.createNewFile();
    await api.projects.loadSaveData(saved);
    expect(blueprint.shaderSettings.floatPrecision).toBe("mediump");
  });

  it("a file saved before the setting existed loads as lowp", async () => {
    // An open project on highp first: the file must not inherit it.
    api.shader.updateInfo({ floatPrecision: "highp" });
    // getSaveData hands back live objects; clone before editing.
    const saved = structuredClone(api.projects.getSaveData());
    delete saved.shaderSettings.floatPrecision;
    await api.projects.loadSaveData(saved);
    expect(blueprint.shaderSettings.floatPrecision).toBe("lowp");
    expect(blueprint.generateAllShaders().webgl2).toContain("precision lowp float;");
  });

  it("the sidebar select follows the setting", () => {
    api.shader.updateInfo({ floatPrecision: "highp" });
    expect(document.getElementById("settingFloatPrecision").value).toBe("highp");
  });
});
