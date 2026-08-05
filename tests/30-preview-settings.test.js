// The anti-drift guard for preview settings.
//
// Every preview setting is described once in preview-settings.js, and six
// places loop over that table: the host's defaults, resetPreviewSettings,
// the projectReady resend, updatePreviewSettingsUI, the scripting API's
// validator and patcher, and the CLI's flags. These tests pin the table against
// the things it claims - that its DOM ids exist, that its enums match the actual
// <select> options, that its CLI flags parse - because the failure mode of a
// wrong descriptor is a control that silently does nothing.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { parseArgs } from "../cli/args.js";
import * as previewCommand from "../cli/commands/preview.js";
import {
  PREVIEW_SETTINGS,
  PREVIEW_SETTING_KEYS,
  makeDefaultPreviewSettings,
  effectiveObjectScale,
  migratePreviewSettings,
} from "../preview-settings.js";

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.previewSettings = makeDefaultPreviewSettings();
});

describe("the settings table is the single source of truth", () => {
  it("seeds exactly the keys the host carries", () => {
    expect(Object.keys(blueprint.previewSettings).sort()).toEqual(
      [...PREVIEW_SETTING_KEYS].sort(),
    );
  });

  it("names DOM elements that actually exist", () => {
    const missing = [];
    for (const d of PREVIEW_SETTINGS) {
      if (!d.dom) continue;
      for (const slot of ["el", "valueEl", "previewEl", "clearBtnEl"]) {
        const id = d.dom[slot];
        if (id && !document.getElementById(id)) {
          missing.push(`${d.key}.${slot} -> #${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps every enum in step with its <select> options", () => {
    let checked = 0;
    for (const d of PREVIEW_SETTINGS) {
      if (d.kind !== "enum" || !d.dom?.el) continue;
      const el = document.getElementById(d.dom.el);
      if (el.tagName !== "SELECT") continue;
      expect(
        [...el.options].map((o) => o.value),
        `${d.key} options`,
      ).toEqual(d.values);
      checked++;
    }
    // Guard against the loop quietly matching nothing.
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("gives every number descriptor slider bounds that match its markup", () => {
    let checked = 0;
    for (const d of PREVIEW_SETTINGS) {
      if (d.kind !== "number" || !d.dom?.el) continue;
      const el = document.getElementById(d.dom.el);
      if (el.type !== "range") continue;
      expect(Number(el.min), `${d.key} min`).toBe(d.min);
      expect(Number(el.max), `${d.key} max`).toBe(d.max);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("keeps updateUIText's :has() label selectors matching", () => {
    // These select a label by the control it sits beside, so they break
    // silently whenever the panel markup is reshaped.
    blueprint.updateUIText();
    for (const id of [
      "objectSelect",
      "cameraModeSelect",
      "samplingModeSelect",
      "anisotropicFilteringSelect",
    ]) {
      const selector = `#preview-controls .preview-control-group:has(#${id}) > label`;
      expect(document.querySelectorAll(selector).length, id).toBe(1);
    }
  });

  it("puts every descriptor's control in the tab its section names", () => {
    // A control filed under the wrong section ends up on a tab the user will
    // not think to look at.
    let checked = 0;
    for (const d of PREVIEW_SETTINGS) {
      const id = d.dom?.el ?? d.dom?.previewEl;
      if (!id) continue;
      const pane = document.getElementById(id).closest(".preview-tab-content");
      expect(pane?.dataset.tab, `${d.key} is on the wrong tab`).toBe(d.section);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it("declares a default that every descriptor's own rules accept", () => {
    for (const d of PREVIEW_SETTINGS) {
      if (d.kind === "enum") {
        expect(d.values, `${d.key} default`).toContain(d.default);
      }
      if (d.kind === "number") {
        expect(typeof d.default, `${d.key} default`).toBe("number");
      }
    }
  });
});

describe("hover tooltips", () => {
  const hover = (el, from) =>
    el.dispatchEvent(
      new window.MouseEvent("mouseover", {
        bubbles: true,
        relatedTarget: from,
      }),
    );
  const unhover = (el, to) =>
    el.dispatchEvent(
      new window.MouseEvent("mouseout", { bubbles: true, relatedTarget: to }),
    );

  it("shows the anchor's text and hides again on the way out", () => {
    const tooltip = document.getElementById("ui-tooltip");
    const label = document.querySelector(
      "#preview-controls label[data-tooltip]",
    );
    expect(label).toBeTruthy();

    hover(label);
    expect(tooltip.classList.contains("visible")).toBe(true);
    expect(tooltip.textContent).toBe(label.dataset.tooltip);

    unhover(label, document.body);
    expect(tooltip.classList.contains("visible")).toBe(false);
  });

  it("stays up while the pointer moves within the anchor", () => {
    const tooltip = document.getElementById("ui-tooltip");
    const anchor = document.querySelector("#preview-controls .scale-lock");
    const inner = anchor.querySelector("svg");
    anchor.dataset.tooltip = "Link the axes";

    hover(anchor);
    expect(tooltip.classList.contains("visible")).toBe(true);

    // Crossing onto a child fires mouseout on the anchor, but has not left it.
    unhover(anchor, inner);
    expect(tooltip.classList.contains("visible")).toBe(true);

    delete anchor.dataset.tooltip;
  });

  it("every tooltip anchor carries non-empty text", () => {
    const anchors = document.querySelectorAll(
      "#preview-controls [data-tooltip]",
    );
    expect(anchors.length).toBeGreaterThanOrEqual(5);
    for (const el of anchors) {
      expect(el.dataset.tooltip.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("preview.updateSettings validation", () => {
  it("accepts the 3D shapes the preview actually supports", () => {
    expect(api.preview.updateSettings({ object: "prism" }).object).toBe(
      "prism",
    );
    expect(api.preview.updateSettings({ object: "corner-in" }).object).toBe(
      "corner-in",
    );
  });

  it("rejects shapes that do not exist", () => {
    // The API used to validate `object` against sphere/cylinder/cone/... none
    // of which the preview's Shape3D can be.
    expect(() => api.preview.updateSettings({ object: "sphere" })).toThrow();
  });

  it("rejects an unknown key", () => {
    expect(() => api.preview.updateSettings({ nope: 1 })).toThrow(
      /Unknown preview setting/,
    );
  });

  it("rejects wrong types per kind", () => {
    expect(() => api.preview.updateSettings({ autoRotate: "yes" })).toThrow(
      /must be a boolean/,
    );
    expect(() => api.preview.updateSettings({ objectScale: "abc" })).toThrow(
      /must be a finite number/,
    );
    expect(() =>
      api.preview.updateSettings({ cameraMode: "isometric" }),
    ).toThrow(/must be one of/);
  });

  it("keeps effectTarget and object in step", () => {
    expect(api.preview.updateSettings({ effectTarget: "shape3D" }).object).toBe(
      "box",
    );
    expect(api.preview.updateSettings({ object: "sprite" }).effectTarget).toBe(
      "sprite",
    );
  });
});

describe("the settings added in this batch", () => {
  it("accepts a hex colour and rejects anything else", () => {
    expect(
      api.preview.updateSettings({ objectColor: "#ff8800" }).objectColor,
    ).toBe("#ff8800");
    expect(() => api.preview.updateSettings({ objectColor: "red" })).toThrow();
    expect(() => api.preview.updateSettings({ objectColor: "#f80" })).toThrow();
  });

  it("accepts the anisotropy modes the C3 runtime knows", () => {
    for (const mode of ["auto", "off", "2x", "3x", "4x", "8x", "16x"]) {
      expect(
        api.preview.updateSettings({ anisotropicFiltering: mode })
          .anisotropicFiltering,
      ).toBe(mode);
    }
    expect(() =>
      api.preview.updateSettings({ anisotropicFiltering: "32x" }),
    ).toThrow();
  });

  it("shows the rotation readout as whole degrees", () => {
    api.preview.updateSettings({ objectAngle: 90 });
    expect(document.getElementById("objectAngleValue").textContent).toBe("90");
  });
});

describe("object scale (#108)", () => {
  it("ignores the Y and Z keys while the axes are linked", () => {
    api.preview.updateSettings({
      objectScale: 2,
      objectScaleY: 0.5,
      objectScaleZ: 0.25,
      objectScaleLinked: true,
    });
    expect(effectiveObjectScale(blueprint.previewSettings)).toEqual({
      x: 2,
      y: 2,
      z: 2,
    });
  });

  it("uses them once unlinked, without touching the base value", () => {
    api.preview.updateSettings({
      objectScale: 2,
      objectScaleY: 0.5,
      objectScaleZ: 3,
      objectScaleLinked: false,
    });
    expect(blueprint.previewSettings.objectScale).toBe(2);
    expect(effectiveObjectScale(blueprint.previewSettings)).toEqual({
      x: 2,
      y: 0.5,
      z: 3,
    });
  });

  it("keeps the base scale a plain number, so old files keep working", () => {
    // Promoting objectScale to an object would break every saved .c3sg while
    // the save-data fixed-point test carried on passing.
    api.preview.updateSettings({ objectScale: 1.6 });
    expect(typeof blueprint.previewSettings.objectScale).toBe("number");
  });

  it("reveals the Y row only when unlinked", () => {
    const row = document.getElementById("objectScaleYRow");
    const chip = document.getElementById("objectScaleXChip");

    api.preview.updateSettings({ objectScaleLinked: true });
    expect(row.style.display).toBe("none");
    expect(chip.style.display).toBe("none");

    api.preview.updateSettings({ objectScaleLinked: false });
    expect(row.style.display).toBe("flex");
    expect(chip.style.display).not.toBe("none");
  });

  it("reveals the Z row only for a 3D shape, since a sprite has no depth", () => {
    const row = document.getElementById("objectScaleZRow");

    api.preview.updateSettings({ objectScaleLinked: false, object: "sprite" });
    expect(row.style.display).toBe("none");

    api.preview.updateSettings({ object: "box" });
    expect(row.style.display).toBe("flex");

    api.preview.updateSettings({ objectScaleLinked: true });
    expect(row.style.display).toBe("none");
  });
});

describe("migrating a file saved before the scales merged", () => {
  it("folds spriteScale into objectScale", () => {
    expect(migratePreviewSettings({ spriteScale: 1.6, shapeScale: 2 })).toEqual(
      {
        objectScale: 1.6,
      },
    );
  });

  it("falls back to shapeScale when that is all the file has", () => {
    expect(migratePreviewSettings({ shapeScale: 2 })).toEqual({
      objectScale: 2,
    });
  });

  it("leaves keys it does not know about alone", () => {
    // A file from a newer build should survive a round-trip through this one.
    expect(migratePreviewSettings({ somethingNewer: 7 })).toEqual({
      somethingNewer: 7,
    });
  });
});

describe("reset and UI push", () => {
  it("resetSettings returns exactly the declared defaults", () => {
    api.preview.updateSettings({ objectScale: 2.5, cameraMode: "perspective" });
    expect(api.preview.resetSettings()).toEqual(makeDefaultPreviewSettings());
  });

  it("writes numbers into both the slider and its readout", () => {
    api.preview.updateSettings({ objectScale: 2.5 });
    expect(document.getElementById("objectScaleSlider").value).toBe("2.5");
    expect(document.getElementById("objectScaleValue").textContent).toBe(
      "2.50",
    );
  });

  it("hides the auto-rotate group in 2D and shows it otherwise", () => {
    const group = document.getElementById("autoRotateGroup");
    api.preview.updateSettings({ cameraMode: "2d" });
    expect(group.style.display).toBe("none");
    api.preview.updateSettings({ cameraMode: "perspective" });
    expect(group.style.display).toBe("flex");
  });
});

// Stand in for a booted preview iframe and record what it is told.
function fakeTarget() {
  const sent = [];
  return {
    sent,
    ready: true,
    post(message) {
      sent.push(message);
    },
    send(command, value) {
      sent.push({ type: "previewCommand", command, value });
    },
    owns() {
      return false;
    },
  };
}

describe("what a patch actually sends", () => {
  let target, realTarget;

  beforeEach(() => {
    realTarget = blueprint.previewTargets[0];
    target = fakeTarget();
    blueprint.previewTargets[0] = target;
  });

  afterEach(() => {
    blueprint.previewTargets[0] = realTarget;
  });

  it("sends one fully-resolved scale command per patch, not one per axis", () => {
    // The four keys resolve into a single setObjectScale. Sending as each key
    // landed would push {x: 2, y: 2, z: 2} before the axes had been stored.
    api.preview.updateSettings({
      objectScale: 2,
      objectScaleY: 0.5,
      objectScaleZ: 3,
      objectScaleLinked: false,
    });

    const scaleCommands = target.sent.filter(
      (m) => m.command === "setObjectScale",
    );
    expect(scaleCommands).toHaveLength(1);
    expect(scaleCommands[0].value).toEqual({ x: 2, y: 0.5, z: 3 });
  });

  it("sends the sibling that a linked setting dragged along", () => {
    api.preview.updateSettings({ effectTarget: "shape3D" });

    const commands = target.sent.map((m) => m.command);
    expect(commands).toContain("setEffectTarget");
    expect(commands).toContain("setObject");
  });

  it("does not send a setting that travels in the iframe URL", () => {
    api.preview.updateSettings({ samplingMode: "nearest" });
    expect(target.sent.map((m) => m.command)).not.toContain("setSamplingMode");
  });
});

describe("applyPreviewSettingsTo", () => {
  it("sends textures before scales, because loading one re-derives the base size", () => {
    const target = fakeTarget();
    blueprint.previewSettings.spriteTextureUrl = "data:image/png;base64,AA==";

    blueprint.applyPreviewSettingsTo(target);

    const textureAt = target.sent.findIndex(
      (m) => m.type === "callFunction" && m.function === "loadSpriteUrl",
    );
    const scaleAt = target.sent.findIndex(
      (m) => m.command === "setObjectScale",
    );
    expect(textureAt).toBeGreaterThanOrEqual(0);
    expect(scaleAt).toBeGreaterThan(textureAt);
  });

  it("never sends the settings that travel in the iframe URL", () => {
    const target = fakeTarget();
    blueprint.applyPreviewSettingsTo(target);

    const commands = target.sent.map((m) => m.command);
    for (const d of PREVIEW_SETTINGS) {
      if (d.reload === true) expect(commands).not.toContain(d.command);
    }
  });

  it("sends each command at most once", () => {
    const target = fakeTarget();
    blueprint.applyPreviewSettingsTo(target);

    const commands = target.sent.map((m) => m.command).filter(Boolean);
    expect(commands.length).toBe(new Set(commands).size);
  });
});

describe("the CLI derives its flags from the same table", () => {
  it("has a unique flag per setting, each naming a real key", () => {
    const flags = PREVIEW_SETTINGS.filter((d) => d.cli).map((d) => d.cli.flag);
    expect(flags.length).toBe(new Set(flags).size);
    for (const d of PREVIEW_SETTINGS) {
      if (d.cli) expect(PREVIEW_SETTING_KEYS.has(d.key)).toBe(true);
    }
  });

  it("lists every boolean setting in `booleans`", () => {
    // Miss one and the parser treats --no-auto-rotate as a flag that eats the
    // next token, silently swallowing the filename. tests/28 cannot catch this:
    // the preview command needs Playwright and is not exercised there.
    for (const d of PREVIEW_SETTINGS) {
      if (d.kind === "bool" && d.cli) {
        expect(previewCommand.booleans, d.key).toContain(d.cli.flag);
      }
    }
  });

  it("parses --no-auto-rotate without eating the filename", () => {
    const { _, flags } = parseArgs(["--no-auto-rotate", "x.c3sg"], {
      booleans: previewCommand.booleans,
      aliases: previewCommand.aliases,
    });
    expect(flags.autoRotate).toBe(false);
    expect(_).toEqual(["x.c3sg"]);
  });

  it("documents a value placeholder for every non-boolean flag", () => {
    for (const d of PREVIEW_SETTINGS) {
      if (d.cli && d.kind !== "bool") {
        expect(d.cli.arg, `${d.key} cli.arg`).toBeTruthy();
      }
    }
  });
});
