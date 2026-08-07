// Issue #119 — "Some keyboard actions still work on the graph when gradient or
// other dialogs are open".
//
// onKeyDown only bailed out when focus happened to be in an INPUT/TEXTAREA or
// CodeMirror. The gradient editor has no such field, so with it open, Delete
// still deleted the selected nodes behind it and Ctrl+Z still undid the graph.
//
// Dialogs come in two flavours: `.modal` (and the JS-built gradient editor)
// toggle inline display, while the custom-node and uniform dialogs toggle a
// `visible` class. isAnyDialogOpen() has to understand both.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

afterEach(() => {
  // Leave every dialog shut, whichever mechanism it uses.
  for (const el of document.querySelectorAll(".modal, #gradientEditorModal")) {
    el.style.display = "none";
  }
  document
    .querySelectorAll(".custom-node-modal, .uniform-modal")
    .forEach((el) => el.classList.remove("visible"));
});

function keyEvent(key, extra = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault() {},
    ...extra,
  };
}

describe("KEYBOARD IS BLOCKED WHILE A DIALOG IS OPEN (#119)", () => {
  it("reports no dialog open on a fresh project", () => {
    expect(blueprint.isAnyDialogOpen()).toBe(false);
  });

  it("sees a display-toggled dialog (the gradient editor)", () => {
    blueprint.gradientEditorModal.style.display = "flex";
    expect(blueprint.isAnyDialogOpen()).toBe(true);

    blueprint.gradientEditorModal.style.display = "none";
    expect(blueprint.isAnyDialogOpen()).toBe(false);
  });

  it("sees a class-toggled dialog (the custom node editor)", () => {
    blueprint.customNodeModal.classList.add("visible");
    expect(blueprint.isAnyDialogOpen()).toBe(true);

    blueprint.customNodeModal.classList.remove("visible");
    expect(blueprint.isAnyDialogOpen()).toBe(false);
  });

  it("sees a .modal dialog", () => {
    const modal = document.getElementById("viewCodeModal");
    modal.style.display = "flex";
    expect(blueprint.isAnyDialogOpen()).toBe(true);
  });

  it("Delete does not reach the graph while the gradient editor is open", () => {
    const node = blueprint.addNode(0, 0, NODE_TYPES.FloatInputNode);
    blueprint.selectNode(node, false);
    const before = blueprint.nodes.length;

    blueprint.gradientEditorModal.style.display = "flex";
    blueprint.onKeyDown(keyEvent("Delete"));

    expect(blueprint.nodes.length).toBe(before);
    expect(blueprint.nodes.includes(node)).toBe(true);
  });

  it("Delete works again once the dialog closes", () => {
    const node = blueprint.addNode(0, 0, NODE_TYPES.FloatInputNode);
    blueprint.selectNode(node, false);
    const before = blueprint.nodes.length;

    blueprint.gradientEditorModal.style.display = "flex";
    blueprint.onKeyDown(keyEvent("Delete"));
    expect(blueprint.nodes.length).toBe(before);

    blueprint.gradientEditorModal.style.display = "none";
    blueprint.onKeyDown(keyEvent("Delete"));
    expect(blueprint.nodes.length).toBe(before - 1);
  });

  it("Ctrl+Z does not undo the graph from inside a dialog", () => {
    const node = blueprint.addNode(0, 0, NODE_TYPES.FloatInputNode);
    blueprint.history.pushState("Add node");
    const before = blueprint.nodes.length;

    blueprint.customNodeModal.classList.add("visible");
    blueprint.onKeyDown(keyEvent("z", { ctrlKey: true }));

    expect(blueprint.nodes.length).toBe(before);
    expect(blueprint.nodes.includes(node)).toBe(true);
  });

  it("does not pollute pressedKeys from inside a dialog", () => {
    blueprint.gradientEditorModal.style.display = "flex";
    blueprint.onKeyDown(keyEvent("2"));
    expect(blueprint.pressedKeys.has("2")).toBe(false);
  });
});
