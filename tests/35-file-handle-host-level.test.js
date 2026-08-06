// Issue #115 — "saving in subgraph tries to save to a new file".
//
// `fileHandle` used to be a per-Graph field routed through the delegation list,
// so `this.fileHandle` meant "the open graph's handle". Every subgraph starts
// with null, so pressing Save from inside a function found no handle and
// re-opened the file picker — then stored the picked handle on the *subgraph*,
// leaving main still pointing at the original file.
//
// One project is one file, so the handle belongs to the host. Same story for
// the suggested filename, which reads the shader name: `this.shaderSettings`
// is still delegated, so it has to come off the main graph explicitly.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("FILE HANDLE IS HOST-LEVEL (#115)", () => {
  it("survives switching into a subgraph", () => {
    const handle = { name: "my-effect.c3sg" };
    blueprint.fileHandle = handle;

    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    blueprint.setActiveGraph(fn.id);

    expect(blueprint.fileHandle).toBe(handle);
  });

  it("is the same handle whichever graph is active", () => {
    const handle = { name: "my-effect.c3sg" };
    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    const loop = blueprint.createLoopBodyGraph({ name: "Accumulate" });

    blueprint.setActiveGraph(fn.id);
    blueprint.fileHandle = handle;

    blueprint.setActiveGraph(loop.id);
    expect(blueprint.fileHandle).toBe(handle);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    expect(blueprint.fileHandle).toBe(handle);
  });

  it("is not stored on Graph instances", () => {
    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    expect(Object.prototype.hasOwnProperty.call(fn, "fileHandle")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(blueprint.mainGraph, "fileHandle"),
    ).toBe(false);
  });

  it("createNewFile clears it", () => {
    blueprint.fileHandle = { name: "my-effect.c3sg" };
    blueprint.createNewFile();
    expect(blueprint.fileHandle).toBeNull();
  });

  describe("projectName", () => {
    it("reads the main graph's shader name while a subgraph is active", () => {
      blueprint.mainGraph.shaderSettings.name = "My Effect";

      const fn = blueprint.createFunctionGraph({ name: "Helper" });
      blueprint.setActiveGraph(fn.id);

      // The delegated view is the subgraph's blank default...
      expect(blueprint.shaderSettings.name).toBe("");
      // ...but the project name is not.
      expect(blueprint.projectName).toBe("My Effect");
      expect(blueprint.sanitizeAddonId(blueprint.projectName)).toBeTruthy();
    });

    it("is empty when the project is unnamed", () => {
      expect(blueprint.projectName).toBe("");
    });
  });
});
