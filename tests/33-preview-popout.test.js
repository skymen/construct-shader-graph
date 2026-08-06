// Popping the preview out into its own browser window.
//
// The preview runs in the docked iframe or in a window of its own, and every
// path that talks to it goes through PreviewTarget rather than reaching for the
// iframe. These tests pin that: the target addresses the right window, the
// docked iframe is blanked so two runtimes never live at once, and closing the
// window puts everything back.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

// A stand-in for what window.open returns. Records what was posted at it.
function fakePopup() {
  return {
    closed: false,
    posted: [],
    location: {
      replaced: [],
      replace(url) {
        this.replaced.push(url);
      },
    },
    postMessage(message) {
      this.posted.push(message);
    },
    close() {
      this.closed = true;
    },
  };
}

let popups;

beforeEach(() => {
  blueprint.createNewFile();
  if (blueprint.defaultPreviewTarget()?.isPoppedOut) blueprint.dockPreview();

  popups = [];
  blueprint.canvas.ownerDocument.defaultView.open = vi.fn(() => {
    const popup = fakePopup();
    popups.push(popup);
    return popup;
  });
});

describe("PreviewTarget addresses whichever window the preview is in", () => {
  it("uses the iframe's window while docked", () => {
    const target = blueprint.defaultPreviewTarget();
    expect(target.isPoppedOut).toBe(false);
    expect(target.win).toBe(target.iframe.contentWindow);
  });

  it("uses the popup once popped out", () => {
    blueprint.popOutPreview();
    const target = blueprint.defaultPreviewTarget();

    expect(target.isPoppedOut).toBe(true);
    expect(target.win).toBe(popups[0]);
  });

  it("posts to the popup, not the iframe", () => {
    blueprint.popOutPreview();
    blueprint.defaultPreviewTarget().send("setObjectAngle", { x: 1 });

    expect(popups[0].posted).toContainEqual({
      type: "previewCommand",
      command: "setObjectAngle",
      value: { x: 1 },
    });
  });

  it("recognises messages from the popup and not from elsewhere", () => {
    blueprint.popOutPreview();
    const target = blueprint.defaultPreviewTarget();

    expect(target.owns(popups[0])).toBe(true);
    expect(target.owns(target.iframe.contentWindow)).toBe(false);
    expect(target.owns(null)).toBe(false);
  });
});

describe("popping out", () => {
  it("opens the same URL the docked preview would have booted from", () => {
    blueprint.popOutPreview();
    const [url] = blueprint.canvas.ownerDocument.defaultView.open.mock.calls[0];

    expect(url).toBe(blueprint.previewUrl());
    expect(url).toContain("preview/index.html?");
  });

  it("blanks the docked iframe so only one runtime is alive", () => {
    blueprint.popOutPreview();
    expect(blueprint.defaultPreviewTarget().iframe.src).toContain(
      "about:blank",
    );
  });

  it("marks the preview as not yet booted", () => {
    blueprint.previewReady = true;
    blueprint.popOutPreview();
    expect(blueprint.previewReady).toBe(false);
  });

  it("is a no-op when already popped out", () => {
    blueprint.popOutPreview();
    expect(blueprint.popOutPreview()).toBe(null);
    expect(popups.length).toBe(1);
  });

  it("reports a blocked pop-up instead of half-detaching", () => {
    blueprint.canvas.ownerDocument.defaultView.open = vi.fn(() => null);

    expect(blueprint.popOutPreview()).toBe(null);
    expect(blueprint.defaultPreviewTarget().isPoppedOut).toBe(false);
  });
});

describe("a reload reaches whichever window the preview is in", () => {
  it("navigates the popup rather than the iframe", () => {
    blueprint.popOutPreview();
    const iframeSrcBefore = blueprint.defaultPreviewTarget().iframe.src;

    blueprint.updatePreview();

    expect(popups[0].location.replaced.length).toBeGreaterThan(0);
    expect(popups[0].location.replaced.at(-1)).toContain("preview/index.html?");
    expect(blueprint.defaultPreviewTarget().iframe.src).toBe(iframeSrcBefore);
  });

  it("leaves a closed popup alone", () => {
    blueprint.popOutPreview();
    popups[0].closed = true;

    expect(() => blueprint.updatePreview()).not.toThrow();
    expect(popups[0].location.replaced.length).toBe(0);
  });
});

describe("docking again", () => {
  it("closes the window and puts the preview back in the iframe", () => {
    blueprint.popOutPreview();
    blueprint.dockPreview();

    const target = blueprint.defaultPreviewTarget();
    expect(target.isPoppedOut).toBe(false);
    expect(popups[0].closed).toBe(true);
    expect(target.win).toBe(target.iframe.contentWindow);
    // updatePreview ran, so the iframe is pointed back at the preview.
    expect(target.iframe.src).toContain("preview/index.html?");
  });

  it("is a no-op when already docked", () => {
    expect(() => blueprint.dockPreview()).not.toThrow();
    expect(blueprint.defaultPreviewTarget().isPoppedOut).toBe(false);
  });

  it("re-docks on its own once the window is closed", () => {
    vi.useFakeTimers();
    try {
      blueprint.popOutPreview();
      popups[0].closed = true;

      vi.advanceTimersByTime(1000);

      expect(blueprint.defaultPreviewTarget().isPoppedOut).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
