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
});
