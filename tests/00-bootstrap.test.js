import { describe, it, expect } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

describe("bootstrap smoke", () => {
  it("loads index.html, instantiates BlueprintSystem, exposes API", async () => {
    const { blueprint, api } = await bootstrap();
    expect(blueprint).toBeTruthy();
    expect(api).toBeTruthy();
    expect(Array.isArray(blueprint.nodes)).toBe(true);
    expect(Array.isArray(blueprint.wires)).toBe(true);
    expect(Array.isArray(blueprint.comments)).toBe(true);
    expect(Array.isArray(blueprint.uniforms)).toBe(true);
    expect(Array.isArray(blueprint.customNodes)).toBe(true);
    expect(blueprint.history).toBeTruthy();
  });

  it("createNewFile produces a non-empty default graph", async () => {
    const { blueprint } = await bootstrap();
    blueprint.createNewFile();
    expect(blueprint.nodes.length).toBeGreaterThan(0);
  });

  // menuActions only binds handlers to buttons that already exist in
  // index.html; it does not create them. An entry that has a handler but no
  // matching button is dead: invisible in the menus and reachable only from
  // the Help search. Entries without a handler are search-only labels, so
  // they are exempt.
  it("every clickable menu action has a button in index.html", async () => {
    const { blueprint } = await bootstrap();
    const missing = blueprint.menuActions
      .filter((action) => typeof action.handler === "function")
      .map((action) => action.action)
      .filter(
        (action) =>
          !document.querySelector(`.dropdown-item[data-action="${action}"]`),
      );
    expect(missing).toEqual([]);
  });

  it("Comment Selection is wired to a real menu button", async () => {
    const { blueprint } = await bootstrap();
    const button = document.querySelector(
      '.dropdown-item[data-action="commentSelection"]',
    );
    expect(button).toBeTruthy();
    expect(
      button.querySelector(".dropdown-item-label").textContent.trim(),
    ).toBe("Comment Selection");

    const action = blueprint.menuActions.find(
      (entry) => entry.action === "commentSelection",
    );
    expect(action.menu).toBe("Project");
    expect(action.shortcut).toBe("Shift+C");
    // The label and the shortcut hint both come from index.html.
    expect(
      button.querySelector(".dropdown-item-shortcut").textContent.trim(),
    ).toBe("Shift+C");
    // Greyed out with nothing selected, enabled once something is.
    expect(action.isEnabled()).toBe(false);
    blueprint.selectedNodes.add(blueprint.nodes[0]);
    expect(action.isEnabled()).toBe(true);
    blueprint.selectedNodes.clear();
  });

  // Issue #132 — the add button belongs under the list it adds to, so it does
  // not drift further from the pointer as the list grows.
  it("every sidebar section puts its add button after its list", async () => {
    await bootstrap();
    const sections = [
      "function-inputs-section",
      "function-outputs-section",
      "uniforms-section",
      "constants-section",
      "functions-section",
      "custom-nodes-section",
    ];

    const misplaced = sections.filter((id) => {
      const last = document
        .getElementById(id)
        .querySelector(".sidebar-section-content").lastElementChild;
      return !(
        last.classList.contains("add-uniform-btn") ||
        last.classList.contains("functions-add-row")
      );
    });
    expect(misplaced).toEqual([]);
  });
});
