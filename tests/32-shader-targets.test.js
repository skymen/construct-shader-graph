// Disabling individual shader languages (issue #76).
//
// A project can switch a language off, and then it must disappear everywhere at
// once: codegen, the .c3addon's files, addon.json's file-list and
// supported-renderers, and the API. The failure mode this guards is a partial
// switch-off - a bundle that lists effect.wgsl in file-list but does not carry
// it, or a preview still pointed at a shader that is no longer generated.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import {
  SHADER_TARGETS,
  TARGET_SETTING_KEYS,
  TARGET_FILENAMES,
  TARGET_RENDERERS,
  enabledTargetsFor,
} from "../shader-targets.js";
import { makeDefaultShaderSettings } from "../Graph.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("enabledTargetsFor", () => {
  it("treats every target as on by default", () => {
    expect(enabledTargetsFor(makeDefaultShaderSettings())).toEqual(
      SHADER_TARGETS,
    );
  });

  it("treats a project saved before the setting existed as all-on", () => {
    // No target keys at all - what every pre-#76 .c3sg looks like.
    expect(enabledTargetsFor({ name: "old" })).toEqual(SHADER_TARGETS);
  });

  it("only false switches a target off, not any other falsy value", () => {
    expect(enabledTargetsFor({ targetWebgpu: undefined })).toEqual(
      SHADER_TARGETS,
    );
    expect(enabledTargetsFor({ targetWebgpu: false })).toEqual([
      "webgl1",
      "webgl2",
    ]);
  });

  it("never returns empty, even if a file asks for it", () => {
    const none = Object.fromEntries(
      SHADER_TARGETS.map((t) => [TARGET_SETTING_KEYS[t], false]),
    );
    expect(enabledTargetsFor(none)).toEqual(SHADER_TARGETS);
  });

  it("preserves generation order regardless of which are on", () => {
    expect(enabledTargetsFor({ targetWebgl2: false })).toEqual([
      "webgl1",
      "webgpu",
    ]);
  });
});

describe("the setting travels with the project", () => {
  it("is part of the default shader settings", () => {
    const defaults = makeDefaultShaderSettings();
    for (const target of SHADER_TARGETS) {
      expect(defaults[TARGET_SETTING_KEYS[target]]).toBe(true);
    }
  });

  it("survives an undo/redo round-trip", () => {
    blueprint.history.clear();
    blueprint.history.initGraphState(
      blueprint.mainGraphId,
      blueprint._exportGraphState(blueprint.mainGraph),
    );

    blueprint.setTargetEnabled("webgpu", false);
    expect(blueprint.enabledTargets()).not.toContain("webgpu");

    blueprint.history.undo();
    expect(blueprint.enabledTargets()).toContain("webgpu");

    blueprint.history.redo();
    expect(blueprint.enabledTargets()).not.toContain("webgpu");
  });

  it("is not shared between history snapshots", () => {
    // shaderSettings is shallow-copied into and out of snapshots, which is
    // exactly why these are flat booleans and not a nested object.
    const before = blueprint.exportState();
    blueprint.setTargetEnabled("webgl1", false);
    expect(before.shaderSettings.targetWebgl1).toBe(true);
  });

  it("is reachable through shader.updateInfo", () => {
    api.shader.updateInfo({ targetWebgl1: false });
    expect(blueprint.enabledTargets()).toEqual(["webgl2", "webgpu"]);
    expect(api.shader.getInfo().targetWebgl1).toBe(false);
  });

  it("round-trips through a .c3sg save/load", async () => {
    blueprint.setTargetEnabled("webgl2", false);
    const payload = {
      version: "1.0.0",
      shaderSettings: blueprint.shaderSettings,
      nodes: [],
      wires: [],
    };

    blueprint.createNewFile();
    await blueprint.loadFromJSON({
      name: "t.c3sg",
      text: async () => JSON.stringify(payload),
    });

    expect(blueprint.enabledTargets()).toEqual(["webgl1", "webgpu"]);
  });

  it("loads a file saved before the setting existed with everything on", async () => {
    const legacy = makeDefaultShaderSettings();
    for (const target of SHADER_TARGETS) {
      delete legacy[TARGET_SETTING_KEYS[target]];
    }

    await blueprint.loadFromJSON({
      name: "old.c3sg",
      text: async () =>
        JSON.stringify({
          version: "1.0.0",
          shaderSettings: legacy,
          nodes: [],
          wires: [],
        }),
    });

    expect(blueprint.enabledTargets()).toEqual(SHADER_TARGETS);
  });
});

// Not about targets as such, but it is the same failure: a setting that exists
// in state and has a control in the sidebar, and no code joining the two. Three
// checkboxes were silently stale this way before the language toggles were
// added, so this walks the settings object rather than naming keys.
describe("updateShaderSettingsUI writes every setting that has a control", () => {
  const controlId = (key) => `setting${key[0].toUpperCase()}${key.slice(1)}`;

  it("refreshes every checkbox the sidebar actually has", () => {
    const doc = blueprint.canvas.ownerDocument;
    const checked = [];
    // The language checkboxes are deliberately not free booleans - the last one
    // standing is forced back on - so they are covered by their own tests above
    // rather than by this blanket flip.
    const languageKeys = new Set(Object.values(TARGET_SETTING_KEYS));

    for (const key of Object.keys(makeDefaultShaderSettings())) {
      if (languageKeys.has(key)) continue;
      const el = doc.getElementById(controlId(key));
      if (!el || el.type !== "checkbox") continue;

      // Flip state behind the UI's back, then ask it to catch up.
      const flipped = !blueprint.shaderSettings[key];
      blueprint.shaderSettings[key] = flipped;
      el.checked = !flipped;

      blueprint.updateShaderSettingsUI();

      expect(
        el.checked,
        `#${controlId(key)} did not follow shaderSettings.${key}`,
      ).toBe(flipped);
      checked.push(key);
    }

    // Guard the guard: if the ids ever change shape this loop would silently
    // check nothing.
    expect(checked).toContain("usesDepth");
    expect(checked).toContain("mustPredraw");
    expect(checked).toContain("supports3DDirectRendering");
    expect(checked.length).toBeGreaterThanOrEqual(8);
  });
});

describe("codegen", () => {
  it("omits a disabled target entirely rather than emitting an empty string", () => {
    blueprint.setTargetEnabled("webgpu", false);
    const shaders = blueprint.generateAllShaders();

    expect(Object.keys(shaders).sort()).toEqual(["webgl1", "webgl2"]);
    expect("webgpu" in shaders).toBe(false);
  });

  it("leaves the surviving targets byte-identical to the all-on build", () => {
    const all = blueprint.generateAllShaders();
    blueprint.setTargetEnabled("webgpu", false);
    const some = blueprint.generateAllShaders();

    expect(some.webgl1).toBe(all.webgl1);
    expect(some.webgl2).toBe(all.webgl2);
  });

  it("still generates all three by default", () => {
    const shaders = blueprint.generateAllShaders();
    expect(Object.keys(shaders).sort()).toEqual(["webgl1", "webgl2", "webgpu"]);
  });
});

describe("the .c3addon bundle", () => {
  it("carries a shader file for each enabled target and no others", () => {
    blueprint.setTargetEnabled("webgl1", false);
    const bundle = blueprint.buildAddonBundle();

    expect(bundle.files["effect.fx"]).toBeUndefined();
    expect(typeof bundle.files["effect.webgl2.fx"]).toBe("string");
    expect(typeof bundle.files["effect.wgsl"]).toBe("string");
    // The non-shader files are unconditional.
    expect(typeof bundle.files["addon.json"]).toBe("string");
    expect(typeof bundle.files["lang/en-US.json"]).toBe("string");
  });

  it("keeps file-list and the actual files in agreement", () => {
    blueprint.setTargetEnabled("webgl2", false);
    const bundle = blueprint.buildAddonBundle();
    const listed = JSON.parse(bundle.files["addon.json"])["file-list"];

    for (const entry of listed) {
      expect(bundle.files[entry]).toBeDefined();
    }
    for (const name of Object.keys(bundle.files)) {
      expect(listed).toContain(name);
    }
  });

  it("declares only the renderers it ships a shader for", () => {
    blueprint.setTargetEnabled("webgpu", false);
    const addon = JSON.parse(blueprint.buildAddonBundle().files["addon.json"]);

    expect(addon["supported-renderers"]).toEqual(["webgl", "webgl2"]);
    expect(addon["file-list"]).not.toContain(TARGET_FILENAMES.webgpu);
  });

  it("declares all three by default", () => {
    const addon = JSON.parse(blueprint.buildAddonBundle().files["addon.json"]);
    expect(addon["supported-renderers"]).toEqual(
      SHADER_TARGETS.map((t) => TARGET_RENDERERS[t]),
    );
  });
});

describe("the last enabled target", () => {
  it("cannot be switched off", () => {
    blueprint.setTargetEnabled("webgl1", false);
    blueprint.setTargetEnabled("webgl2", false);
    expect(blueprint.enabledTargets()).toEqual(["webgpu"]);

    expect(blueprint.setTargetEnabled("webgpu", false)).toBe(false);
    expect(blueprint.enabledTargets()).toEqual(["webgpu"]);
  });
});

describe("the preview language follows the enabled set", () => {
  it("moves off a language that was just disabled", () => {
    blueprint.previewSettings.shaderLanguage = "webgpu";
    blueprint.setTargetEnabled("webgpu", false);

    expect(blueprint.previewSettings.shaderLanguage).not.toBe("webgpu");
    expect(blueprint.enabledTargets()).toContain(
      blueprint.previewSettings.shaderLanguage,
    );
  });

  it("leaves a still-enabled language alone", () => {
    blueprint.previewSettings.shaderLanguage = "webgl1";
    blueprint.setTargetEnabled("webgpu", false);

    expect(blueprint.previewSettings.shaderLanguage).toBe("webgl1");
  });

  it("prefers the best renderer left rather than the first generated", () => {
    blueprint.previewSettings.shaderLanguage = "webgl1";
    blueprint.setTargetEnabled("webgl1", false);

    // Generation order starts at webgl1; the preview should still land on
    // WebGL 2 over nothing and WebGPU over WebGL 2.
    expect(blueprint.previewSettings.shaderLanguage).toBe("webgpu");
  });

  it("does not send a shader for a disabled language to the preview", () => {
    blueprint.setTargetEnabled("webgpu", false);
    const data = blueprint.buildShaderData(blueprint.generateAllShaders());

    expect(data.wgsl).toBeUndefined();
    expect(typeof data.glsl).toBe("string");
    expect(typeof data.glslWebGL2).toBe("string");
  });
});

describe("the scripting API", () => {
  it("refuses to hand back a disabled target", () => {
    blueprint.setTargetEnabled("webgpu", false);
    expect(() => api.shader.getGeneratedCode({ target: "webgpu" })).toThrow(
      /disabled/i,
    );
  });

  it("still serves an enabled target", () => {
    blueprint.setTargetEnabled("webgpu", false);
    const code = api.shader.getGeneratedCode({ target: "webgl2" });
    expect(typeof code.webgl2).toBe("string");
  });

  it("reports the enabled set from graph.validate", () => {
    blueprint.setTargetEnabled("webgl1", false);
    expect(api.graph.validate().targets.sort()).toEqual(["webgl2", "webgpu"]);
  });
});
