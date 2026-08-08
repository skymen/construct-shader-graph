// Issue #99 — "Moving camera doesnt move the visible HTML elements that are
// attached to nodes".
//
// The port value editors, the custom input field and the operation/variable
// dropdowns are real DOM elements. They are position:fixed and were placed
// once, in screen space, from the world position of the node they belong to.
// Nothing repositioned them, so a scroll or a zoom left them floating over the
// wrong part of the graph while the node slid away.
//
// They follow the camera instead of closing: closing means committing, and a
// commit recompiles the shader, which on a scroll is once per frame.
//
// Every camera mutation is followed by render(), so render() compares the live
// camera against the one captured when the overlay opened and re-runs the
// world -> screen transform on any difference.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.cancelEditingPort();
  document.querySelectorAll(".operation-menu").forEach((m) => m.remove());
});

// The first editable, unconnected float input on a freshly placed node.
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

const px = (value) => parseFloat(value);

describe("CANVAS OVERLAYS FOLLOW THE CAMERA (#99)", () => {
  it("moves the port editor by the pan delta", () => {
    blueprint.startEditingPort(editablePort());
    const left = px(blueprint.inputField.style.left);
    const top = px(blueprint.inputField.style.top);

    blueprint.camera.x += 120;
    blueprint.camera.y -= 45;
    blueprint.render();

    expect(px(blueprint.inputField.style.left)).toBeCloseTo(left + 120, 5);
    expect(px(blueprint.inputField.style.top)).toBeCloseTo(top - 45, 5);
    expect(blueprint.editingPort).toBeTruthy();
    expect(blueprint.inputField.style.display).toBe("block");
  });

  it("rescales the port editor when the camera zooms", () => {
    blueprint.startEditingPort(editablePort());
    const width = px(blueprint.inputField.style.width);
    const fontSize = px(blueprint.inputField.style.fontSize);

    blueprint.camera.zoom *= 2;
    blueprint.render();

    expect(px(blueprint.inputField.style.width)).toBeCloseTo(width * 2, 5);
    expect(px(blueprint.inputField.style.fontSize)).toBeCloseTo(
      fontSize * 2,
      5,
    );
  });

  // The whole point of following instead of closing: no commit, so no shader
  // recompile and no history entry per frame of a scroll.
  it("does not commit the edit in flight", () => {
    const port = editablePort();
    const before = port.value;
    blueprint.startEditingPort(port);
    blueprint.inputField.value = "7.5";

    const undoDepth = blueprint.history.undoStack.length;
    for (let i = 0; i < 10; i++) {
      blueprint.camera.x += 8;
      blueprint.render();
    }

    expect(port.value).toBe(before);
    expect(blueprint.history.undoStack.length).toBe(undoDepth);
    expect(blueprint.inputField.value).toBe("7.5");
  });

  it("leaves the editor alone while the camera holds still", () => {
    blueprint.startEditingPort(editablePort());
    const left = blueprint.inputField.style.left;

    blueprint.render();
    blueprint.render();

    expect(blueprint.inputField.style.left).toBe(left);
    expect(blueprint.editingPort).toBeTruthy();
  });

  it("keeps an open node dropdown anchored to its node", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.math);
    blueprint.showOperationMenu(node, { x: 40, y: 60, width: 100, height: 20 });
    const menu = document.querySelector(".operation-menu");
    expect(menu).toBeTruthy();
    const left = px(menu.style.left);

    blueprint.camera.x -= 200;
    blueprint.render();

    expect(document.querySelector(".operation-menu")).toBe(menu);
    expect(px(menu.style.left)).toBeCloseTo(left - 200, 5);
  });

  it("scales an open node dropdown with the zoom it opened at", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.math);
    blueprint.showOperationMenu(node, { x: 40, y: 60, width: 100, height: 20 });
    const menu = document.querySelector(".operation-menu");
    expect(menu.style.transform).toBe("none");
    const width = px(menu.style.width);

    blueprint.camera.zoom *= 1.5;
    blueprint.render();

    expect(menu.style.transform).toBe("scale(1.5)");
    expect(menu.style.transformOrigin).toBe("top left");
    // The transform already carries the zoom; scaling the width as well would
    // apply it twice and the menu would outgrow the dropdown it hangs from.
    expect(px(menu.style.width)).toBeCloseTo(width, 5);
  });
});
