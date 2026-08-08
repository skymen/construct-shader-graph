// Issue #99 — "Moving camera doesnt move the visible HTML elements that are
// attached to nodes".
//
// The port value editors, the custom input field and the operation/variable
// dropdowns are real DOM elements. They are positioned once, in screen space,
// from the world position of the node they belong to. Nothing repositions
// them, so a scroll or a zoom leaves them floating over the wrong part of the
// graph while the node they belong to slides away.
//
// The fix closes them instead. Every camera mutation is followed by render(),
// so render() compares the live camera against the one captured when the
// overlay opened and closes on any difference.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.closeCanvasOverlays();
});

// The first editable, unconnected input port on a freshly placed node.
function editablePort() {
  const node = blueprint.addNode(100, 100, NODE_TYPES.arcSDF);
  const port = node.inputPorts.find(
    (p) =>
      p.isEditable &&
      p.connections.length === 0 &&
      p.getResolvedType() === "float",
  );
  expect(port).toBeTruthy();
  return port;
}

describe("CANVAS OVERLAYS CLOSE ON CAMERA MOVE (#99)", () => {
  it("closes the port editor when the camera pans", () => {
    blueprint.startEditingPort(editablePort());
    expect(blueprint.editingPort).toBeTruthy();
    expect(blueprint.inputField.style.display).toBe("block");

    blueprint.camera.x += 120;
    blueprint.render();

    expect(blueprint.editingPort).toBeNull();
    expect(blueprint.inputField.style.display).toBe("none");
  });

  it("closes the port editor when the camera zooms", () => {
    blueprint.startEditingPort(editablePort());
    expect(blueprint.editingPort).toBeTruthy();

    blueprint.camera.zoom *= 1.25;
    blueprint.render();

    expect(blueprint.editingPort).toBeNull();
  });

  it("commits the typed value on the way out", () => {
    const port = editablePort();
    blueprint.startEditingPort(port);
    blueprint.inputField.value = "7.5";

    blueprint.camera.y -= 40;
    blueprint.render();

    expect(port.value).toBe(7.5);
  });

  it("leaves the editor open while the camera holds still", () => {
    blueprint.startEditingPort(editablePort());

    blueprint.render();
    blueprint.render();

    expect(blueprint.editingPort).toBeTruthy();
    expect(blueprint.inputField.style.display).toBe("block");
  });

  it("removes an open node dropdown when the camera moves", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.math);
    blueprint.showOperationMenu(node, { x: 0, y: 0, width: 100, height: 20 });
    expect(document.querySelectorAll(".operation-menu").length).toBe(1);

    blueprint.camera.x -= 200;
    blueprint.render();

    expect(document.querySelectorAll(".operation-menu").length).toBe(0);
  });
});
