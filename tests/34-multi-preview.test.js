// Several preview windows at once, each with its own settings (issue #78).
//
// The thing that makes this work is that no control inside a preview panel
// carries a shared id: the panel is a clone of #preview-window-template and
// every lookup resolves `data-preview-el` within one window's own root. These
// tests pin that isolation from both ends - state and DOM - because the failure
// mode is silent: window 2's slider quietly driving window 1.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import {
  PREVIEW_SETTINGS,
  makeDefaultPreviewSettings,
} from "../preview-settings.js";

// Enough of a Window to stand in for a popped-out preview: recognised by
// owns(), navigable by navigate(), closable, and titled.
function fakePopup() {
  return {
    closed: false,
    document: {},
    location: {
      replace() {},
    },
    postMessage() {},
    close() {
      this.closed = true;
    },
  };
}

let blueprint, api;

beforeAll(async () => {
  ({ blueprint, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  // Back to a single, quiet window between tests.
  while (blueprint.previewTargets.length > 1) {
    blueprint.previewTargets.at(-1).popup = null;
    blueprint.removePreviewWindow(blueprint.previewTargets.at(-1));
  }
  const first = blueprint.defaultPreviewTarget();
  first.popup = null;
  first.settings = makeDefaultPreviewSettings();
  first.consoleEntries = [];
  blueprint.resetPreviewErrors(first);
  // Window 0 can be left minimised by a previous test - it is never removed,
  // so nothing else would put it back.
  blueprint.showPreviewWindow(first);
});

describe("the panel is cloned, not shared", () => {
  it("starts with exactly one window", () => {
    expect(blueprint.previewTargets).toHaveLength(1);
    expect(blueprint.defaultPreviewTarget().root).toBeTruthy();
  });

  it("mounts a second panel with its own root", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    expect(blueprint.previewTargets).toHaveLength(2);
    expect(second.root).not.toBe(first.root);
    expect(second.id).not.toBe(first.id);
  });

  it("leaves no duplicate ids behind", () => {
    blueprint.addPreviewWindow();
    blueprint.addPreviewWindow();

    const doc = blueprint.canvas.ownerDocument;
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    const seen = new Set();
    const duplicates = ids.filter((id) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    expect(duplicates).toEqual([]);
  });

  it("keeps <label> pointing at a control in its own window", () => {
    const win0 = blueprint.defaultPreviewTarget();
    const first = (name) => win0.el(name);
    const second = blueprint.addPreviewWindow();

    for (const label of second.root.querySelectorAll("[data-preview-for]")) {
      const control = second.el(label.dataset.previewFor);
      expect(control, label.dataset.previewFor).toBeTruthy();
      // The label points at the control's generated id, and that control is
      // this window's, not the other one's.
      expect(label.htmlFor, label.dataset.previewFor).toBe(control.id);
      expect(first(label.dataset.previewFor)?.id).not.toBe(label.htmlFor);
    }
  });

  it("resolves each window's controls to different elements", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    for (const d of PREVIEW_SETTINGS) {
      if (!d.dom?.el) continue;
      expect(first.el(d.dom.el), d.key).toBeTruthy();
      expect(second.el(d.dom.el), d.key).toBeTruthy();
      expect(second.el(d.dom.el), d.key).not.toBe(first.el(d.dom.el));
    }
  });
});

describe("settings are per window", () => {
  it("gives each window its own object", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    expect(second.settings).not.toBe(first.settings);
  });

  it("copies the opener's settings rather than starting from defaults", () => {
    const first = blueprint.defaultPreviewTarget();
    first.settings.objectColor = "#123456";

    const second = blueprint.addPreviewWindow({
      settings: { ...first.settings },
    });

    expect(second.settings.objectColor).toBe("#123456");
    // A copy, not the same object - editing one must not move the other.
    second.settings.objectColor = "#abcdef";
    expect(first.settings.objectColor).toBe("#123456");
  });

  it("does not leak a change from one window into another", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    second.settings.shaderLanguage = "webgl1";
    second.settings.objectScale = 3;

    expect(first.settings.shaderLanguage).toBe(
      makeDefaultPreviewSettings().shaderLanguage,
    );
    expect(first.settings.objectScale).toBe(
      makeDefaultPreviewSettings().objectScale,
    );
  });

  it("writes each window's DOM from its own settings", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    first.settings.backgroundMode = "3d";
    second.settings.backgroundMode = "none";
    blueprint.updateAllPreviewSettingsUI();

    expect(first.el("backgroundModeSelect").value).toBe("3d");
    expect(second.el("backgroundModeSelect").value).toBe("none");
  });

  it("boots each window from its own reload-only settings", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    first.settings.shaderLanguage = "webgpu";
    second.settings.shaderLanguage = "webgl1";

    expect(blueprint.previewUrl(first.settings)).toContain(
      "shaderLanguage=webgpu",
    );
    expect(blueprint.previewUrl(second.settings)).toContain(
      "shaderLanguage=webgl1",
    );
  });

  it("resets only the window that asked", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    first.settings.objectScale = 4;
    second.settings.objectScale = 5;
    blueprint.resetPreviewSettings(second);

    expect(first.settings.objectScale).toBe(4);
    expect(second.settings.objectScale).toBe(
      makeDefaultPreviewSettings().objectScale,
    );
  });

  it("keeps previewSettings pointing at window 0", () => {
    const first = blueprint.defaultPreviewTarget();
    blueprint.addPreviewWindow();

    expect(blueprint.previewSettings).toBe(first.settings);
  });
});

// The scripting API and the CLI both say "the preview" without naming one, and
// both must keep resolving that to window 0. This is the surface that broke
// when the console moved off the host and onto each window - the CLI's preview
// command threw on state that no longer existed there.
describe("the scripting API still addresses window 0", () => {
  it("reads window 0's console, not a host-level one", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    blueprint.addConsoleEntry("from window 1", "log", first);
    blueprint.addConsoleEntry("from window 2", "log", second);

    const entries = api.preview.getConsoleEntries().map((e) => e.message);
    expect(entries).toContain("from window 1");
    expect(entries).not.toContain("from window 2");
  });

  it("reports errors from window 0", () => {
    const first = blueprint.defaultPreviewTarget();
    blueprint.handlePreviewError("bad shader", "error", first);

    expect(api.preview.getErrors().map((e) => e.message)).toContain(
      "bad shader",
    );
  });

  it("survives being asked before anything has been logged", () => {
    expect(() => api.preview.getConsoleEntries()).not.toThrow();
    expect(api.preview.getConsoleEntries()).toEqual([]);
  });

  it("clears window 0's console", () => {
    const first = blueprint.defaultPreviewTarget();
    blueprint.addConsoleEntry("noise", "log", first);
    expect(api.preview.getConsoleEntries()).not.toHaveLength(0);

    api.preview.clearConsole();
    expect(api.preview.getConsoleEntries()).toHaveLength(0);
  });

  it("patches window 0's settings and leaves the others alone", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    api.preview.updateSettings({ objectColor: "#0f0f0f" });

    expect(first.settings.objectColor).toBe("#0f0f0f");
    expect(second.settings.objectColor).not.toBe("#0f0f0f");
  });
});

describe("messages are attributed to the window that sent them", () => {
  function attach(target) {
    target.popup = fakePopup();
    return target.popup;
  }

  it("routes an error into the console of the window that raised it", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const source = attach(second);

    blueprint.onPreviewMessage({
      source,
      data: { type: "shaderError", message: "boom", severity: "error" },
    });

    expect(second.errorCount).toBe(1);
    expect(first.errorCount).toBe(0);
    expect(second.consoleEntries.map((e) => e.message)).toContain("boom");
    expect(first.consoleEntries).toHaveLength(0);
  });

  it("routes a console log to its own window", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const source = attach(second);

    blueprint.onPreviewMessage({
      source,
      data: { type: "consoleLog", message: "hello", level: "log" },
    });

    expect(second.consoleEntries.map((e) => e.message)).toContain("hello");
    expect(first.consoleEntries).toHaveLength(0);
  });

  it("stores a zoom change on the right window's settings", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const source = attach(second);

    blueprint.onPreviewMessage({
      source,
      data: { type: "zoomLevelChanged", zoomLevel: 2.5 },
    });

    expect(second.settings.zoomLevel).toBe(2.5);
    expect(first.settings.zoomLevel).not.toBe(2.5);
  });

  it("ignores a message from a window it does not own", () => {
    const first = blueprint.defaultPreviewTarget();

    expect(() =>
      blueprint.onPreviewMessage({
        source: { postMessage() {} },
        data: { type: "shaderError", message: "stray", severity: "error" },
      }),
    ).not.toThrow();
    expect(first.errorCount).toBe(0);
  });

  it("marks only the reporting window as booted", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const source = attach(second);
    first.ready = false;
    second.ready = false;

    blueprint.onPreviewMessage({
      source,
      data: { type: "projectReady", commands: [] },
    });

    expect(second.ready).toBe(true);
    expect(first.ready).toBe(false);
  });
});

describe("the window count is capped", () => {
  it("refuses to open more than the cap", () => {
    for (let i = 1; i < blueprint.maxPreviewWindows; i++) {
      expect(blueprint.addPreviewWindow()).toBeTruthy();
    }
    expect(blueprint.previewTargets).toHaveLength(blueprint.maxPreviewWindows);

    expect(blueprint.addPreviewWindow()).toBe(null);
    expect(blueprint.previewTargets).toHaveLength(blueprint.maxPreviewWindows);
  });
});

describe("closing a window", () => {
  it("removes the panel from the document", () => {
    const second = blueprint.addPreviewWindow();
    const root = second.root;

    expect(blueprint.removePreviewWindow(second)).toBe(true);
    expect(blueprint.previewTargets).toHaveLength(1);
    expect(root.isConnected).toBe(false);
  });

  it("refuses to remove window 0, which the API and CLI address", () => {
    const first = blueprint.defaultPreviewTarget();

    expect(blueprint.removePreviewWindow(first)).toBe(false);
    expect(blueprint.previewTargets).toContain(first);
  });
});

describe("windows survive a save/load round-trip", () => {
  const load = (payload) =>
    blueprint.loadFromJSON({
      name: "t.c3sg",
      text: async () => JSON.stringify(payload),
    });

  it("restores every window and its settings", async () => {
    const first = blueprint.defaultPreviewTarget();
    first.settings.objectColor = "#111111";
    const second = blueprint.addPreviewWindow({
      settings: {
        ...makeDefaultPreviewSettings(),
        objectColor: "#222222",
        shaderLanguage: "webgl1",
      },
    });
    second.root.style.left = "40px";

    const payload = {
      version: "1.0.0",
      previewSettings: first.settings,
      previewWindows: blueprint.previewTargets.map((t) => ({
        settings: t.settings,
        geometry: t.geometry,
      })),
      nodes: [],
      wires: [],
    };

    await load(payload);

    expect(blueprint.previewTargets).toHaveLength(2);
    expect(blueprint.previewTargets[0].settings.objectColor).toBe("#111111");
    expect(blueprint.previewTargets[1].settings.objectColor).toBe("#222222");
    expect(blueprint.previewTargets[1].settings.shaderLanguage).toBe("webgl1");
    expect(blueprint.previewTargets[1].root.style.left).toBe("40px");
  });

  it("opens a file written before extra windows existed with just one", async () => {
    blueprint.addPreviewWindow();
    expect(blueprint.previewTargets).toHaveLength(2);

    await load({
      version: "1.0.0",
      previewSettings: {
        ...makeDefaultPreviewSettings(),
        objectColor: "#333333",
      },
      nodes: [],
      wires: [],
    });

    expect(blueprint.previewTargets).toHaveLength(1);
    expect(blueprint.previewSettings.objectColor).toBe("#333333");
  });

  it("does not carry the previous file's extra windows over", async () => {
    blueprint.addPreviewWindow();
    blueprint.addPreviewWindow();

    await load({
      version: "1.0.0",
      previewWindows: [{ settings: makeDefaultPreviewSettings() }],
      nodes: [],
      wires: [],
    });

    expect(blueprint.previewTargets).toHaveLength(1);
  });
});

// Closing, minimising and restoring.
//
// A popped-out preview's panel is only a placeholder - closing it must put it
// away, not destroy the browser window the user is actually looking at. That is
// the distinction these pin, along with the eye button that brings back
// however many are hidden.
describe("closing a preview", () => {
  function popOut(target) {
    target.popup = fakePopup();
    return target.popup;
  }

  it("removes a docked extra outright", () => {
    const second = blueprint.addPreviewWindow();
    const root = second.root;

    blueprint.closePreviewWindow(second);

    expect(blueprint.previewTargets).toHaveLength(1);
    expect(root.isConnected).toBe(false);
  });

  it("minimises a popped-out extra instead of destroying it", () => {
    const second = blueprint.addPreviewWindow();
    const popup = popOut(second);

    blueprint.closePreviewWindow(second);

    expect(blueprint.previewTargets).toContain(second);
    expect(second.isPoppedOut).toBe(true);
    expect(popup.closed).toBe(false);
    expect(blueprint.isPreviewVisible(second)).toBe(false);
  });

  it("minimises window 0 rather than removing it", () => {
    const first = blueprint.defaultPreviewTarget();

    blueprint.closePreviewWindow(first);

    expect(blueprint.previewTargets).toContain(first);
    expect(blueprint.isPreviewVisible(first)).toBe(false);
  });

  it("brings the panel back when a minimised pop-out is docked again", () => {
    const second = blueprint.addPreviewWindow();
    popOut(second);
    blueprint.closePreviewWindow(second);
    expect(blueprint.isPreviewVisible(second)).toBe(false);

    blueprint.dockPreview(second);

    expect(second.isPoppedOut).toBe(false);
    expect(blueprint.isPreviewVisible(second)).toBe(true);
  });
});

describe("the eye button", () => {
  const eye = () =>
    blueprint.canvas.ownerDocument.getElementById("openPreviewBtn");

  it("stays hidden while every preview is on screen", () => {
    blueprint.updateOpenPreviewButton();
    expect(eye().style.display).toBe("none");
  });

  it("appears once something is minimised", () => {
    blueprint.minimisePreviewWindow(blueprint.defaultPreviewTarget());
    expect(eye().style.display).toBe("flex");
  });

  it("counts more than one and drops the count back at one", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    blueprint.minimisePreviewWindow(first);
    blueprint.minimisePreviewWindow(second);
    expect(eye().querySelector(".preview-restore-count")?.textContent).toBe(
      "2",
    );
    expect(eye().title).toContain("2");

    blueprint.showPreviewWindow(second);
    expect(eye().querySelector(".preview-restore-count")).toBe(null);
  });

  it("restores every minimised preview at once", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const third = blueprint.addPreviewWindow();
    [first, second, third].forEach((t) => blueprint.minimisePreviewWindow(t));
    expect(blueprint.minimisedPreviews()).toHaveLength(3);

    eye().click();

    expect(blueprint.minimisedPreviews()).toHaveLength(0);
    expect(eye().style.display).toBe("none");
  });
});

describe("previews are numbered once there is more than one", () => {
  const heading = (target) =>
    target.root.querySelector('[data-preview-el="preview-header"] span')
      .textContent;

  it("leaves a lone preview unnumbered", () => {
    expect(heading(blueprint.defaultPreviewTarget())).toBe("Preview");
  });

  it("numbers them from 1 once a second appears", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    expect(heading(first)).toBe("Preview 1");
    expect(heading(second)).toBe("Preview 2");
  });

  it("renumbers after one is closed", () => {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    const third = blueprint.addPreviewWindow();
    expect(heading(third)).toBe("Preview 3");

    blueprint.removePreviewWindow(second);

    expect(heading(first)).toBe("Preview 1");
    expect(heading(third)).toBe("Preview 2");
  });

  it("drops the number again when only one is left", () => {
    const second = blueprint.addPreviewWindow();
    blueprint.removePreviewWindow(second);

    expect(heading(blueprint.defaultPreviewTarget())).toBe("Preview");
  });

  it("titles a popped-out window after the shader and its number", () => {
    blueprint.mainGraph.shaderSettings.name = "my shader";
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();

    expect(blueprint.previewWindowTitle(first)).toBe("my shader - Preview #1");
    expect(blueprint.previewWindowTitle(second)).toBe("my shader - Preview #2");
  });

  it("omits the number when there is only one window", () => {
    blueprint.mainGraph.shaderSettings.name = "my shader";
    expect(blueprint.previewWindowTitle(blueprint.defaultPreviewTarget())).toBe(
      "my shader - Preview",
    );
  });

  it("falls back to just the number when the shader is unnamed", () => {
    blueprint.mainGraph.shaderSettings.name = "";
    const first = blueprint.defaultPreviewTarget();
    blueprint.addPreviewWindow();

    expect(blueprint.previewWindowTitle(first)).toBe("Preview #1");
  });

  it("writes the title onto the popped-out window", () => {
    blueprint.mainGraph.shaderSettings.name = "my shader";
    const target = blueprint.defaultPreviewTarget();
    target.popup = fakePopup();

    blueprint.applyPoppedOutTitle(target);

    expect(target.popup.document.title).toBe("my shader - Preview");
  });
});

describe("the close button says which it will do", () => {
  const closeTitle = (target) => target.el("closePreviewBtn").title;

  it("offers to close a docked extra", () => {
    const second = blueprint.addPreviewWindow();
    expect(closeTitle(second)).toBe("Close Preview");
  });

  it("offers to minimise window 0, which cannot be closed", () => {
    expect(closeTitle(blueprint.defaultPreviewTarget())).toBe(
      "Minimise Preview",
    );
  });

  it("offers to minimise an extra once it is popped out", () => {
    const second = blueprint.addPreviewWindow();
    expect(closeTitle(second)).toBe("Close Preview");

    second.popup = fakePopup();
    blueprint.renumberPreviewWindows();

    expect(closeTitle(second)).toBe("Minimise Preview");
  });
});

// Anything that changes the *shader* must reach every window, not just the
// first - they all display the same shader, so leaving the others on the old
// one is the bug this guards. Per-window settings are the opposite case and
// must stay targeted.
describe("a shader change reloads every window", () => {
  // The URL each preview was last pointed at, which is what a reload changes.
  const bootedUrls = () => blueprint.previewTargets.map((t) => t.iframe.src);

  function twoWindows() {
    const first = blueprint.defaultPreviewTarget();
    const second = blueprint.addPreviewWindow();
    // Park both somewhere recognisable so a reload is visible as a change.
    for (const t of [first, second]) t.iframe.src = "about:blank";
    return [first, second];
  }

  it("reloads both when the graph changes", () => {
    const [first, second] = twoWindows();

    blueprint.onShaderChanged();

    expect(first.iframe.src).toContain("preview/index.html?");
    expect(second.iframe.src).toContain("preview/index.html?");
  });

  it("reloads both when a node is pinned as the preview", () => {
    const [first, second] = twoWindows();
    const node = blueprint.nodes.find((n) =>
      n.outputPorts?.some((p) =>
        ["float", "vec2", "vec3", "vec4"].includes(p.portType),
      ),
    );
    expect(node, "needs a node with a previewable output").toBeTruthy();

    api.preview.setNodePreview(node.id);

    expect(first.iframe.src).toContain("preview/index.html?");
    expect(second.iframe.src).toContain("preview/index.html?");
  });

  it("reloads both when the pin is cleared again", () => {
    const [first, second] = twoWindows();

    api.preview.setNodePreview(null);

    expect(first.iframe.src).toContain("preview/index.html?");
    expect(second.iframe.src).toContain("preview/index.html?");
  });

  it("marks every window as re-booting, not just the first", () => {
    const [first, second] = twoWindows();
    first.ready = true;
    second.ready = true;

    blueprint.onShaderChanged();

    expect(first.ready).toBe(false);
    expect(second.ready).toBe(false);
  });

  it("generates the shader once for the whole set, not once per window", () => {
    twoWindows();
    let generated = 0;
    const real = blueprint.generateAllShaders.bind(blueprint);
    blueprint.generateAllShaders = () => {
      generated++;
      return real();
    };

    try {
      blueprint.updateAllPreviews();
    } finally {
      delete blueprint.generateAllShaders;
    }

    expect(generated).toBe(1);
  });

  it("pushes a uniform value change to every window", () => {
    const [first, second] = twoWindows();
    const sent = new Map();
    for (const t of [first, second]) {
      sent.set(t, []);
      t.ready = true;
      t.popup = {
        closed: false,
        document: {},
        location: { replace() {} },
        close() {},
        postMessage(message) {
          sent.get(t).push(message);
        },
      };
    }
    blueprint.uniforms = [{ id: 1, name: "amount", type: "float", value: 0.5 }];

    blueprint.onUniformValueChanged();

    for (const t of [first, second]) {
      expect(sent.get(t).map((m) => m.type)).toContain("updateParam");
    }
  });

  it("still reloads only the window whose own setting changed", () => {
    const [first, second] = twoWindows();

    // A reload-only setting belongs to one window.
    second.settings.shaderLanguage = "webgl1";
    blueprint.updatePreview(second);

    expect(first.iframe.src).toContain("about:blank");
    expect(second.iframe.src).toContain("shaderLanguage=webgl1");
  });
});

// Start-up ordering.
//
// setupPreview() runs from the constructor, before createNewFile() has added
// any nodes, so asking it for a shader there produced a "no Output node" error
// that corrected itself a moment later. A preview window is built without a
// shader; whoever creates the graph loads it.
describe("booting does not report a shader error it is about to fix", () => {
  it("does not compile while a window is being built", () => {
    let generated = 0;
    const real = blueprint.generateAllShaders.bind(blueprint);
    blueprint.generateAllShaders = () => {
      generated++;
      return real();
    };

    try {
      blueprint.addPreviewWindow({ reload: false });
    } finally {
      delete blueprint.generateAllShaders;
    }

    expect(generated).toBe(0);
  });

  it("still compiles for a window opened normally", () => {
    let generated = 0;
    const real = blueprint.generateAllShaders.bind(blueprint);
    blueprint.generateAllShaders = () => {
      generated++;
      return real();
    };

    try {
      blueprint.addPreviewWindow();
    } finally {
      delete blueprint.generateAllShaders;
    }

    expect(generated).toBe(1);
  });

  it("raises no preview error while creating a new project", () => {
    blueprint.addPreviewWindow();
    blueprint.previewTargets.forEach((t) => blueprint.resetPreviewErrors(t));

    blueprint.createNewFile();

    for (const target of blueprint.previewTargets) {
      expect(target.errorCount, "spurious error during createNewFile").toBe(0);
    }
  });

  it("loads the preview once the new project's nodes exist", () => {
    const first = blueprint.defaultPreviewTarget();
    first.iframe.src = "about:blank";

    blueprint.createNewFile();

    expect(first.iframe.src).toContain("preview/index.html?");
  });

  it("restores a file's extra windows without compiling the old graph", () => {
    let generated = 0;
    const real = blueprint.generateAllShaders.bind(blueprint);
    blueprint.generateAllShaders = () => {
      generated++;
      return real();
    };

    try {
      blueprint.restorePreviewWindows({
        previewWindows: [
          { settings: makeDefaultPreviewSettings() },
          { settings: makeDefaultPreviewSettings() },
        ],
      });
    } finally {
      delete blueprint.generateAllShaders;
    }

    expect(blueprint.previewTargets).toHaveLength(2);
    expect(generated).toBe(0);
  });
});
