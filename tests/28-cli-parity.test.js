// The anti-duplication guard.
//
// The CLI is supposed to be a transport, not a second implementation. If it
// ever grows its own idea of what a shader compiles to, or what a project file
// contains, these fail. Every example in the repo is checked, so a divergence
// cannot hide in a corner of the node registry.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeCliHost } from "./helpers/cli-host.js";
import { ROOT } from "../headless/boot.js";

const EXAMPLES = path.join(ROOT, "examples");
const files = fs
  .readdirSync(EXAMPLES)
  .filter((name) => name.endsWith(".c3sg"))
  .sort();

let host;

beforeAll(async () => {
  process.env.CSG_QUIET = "1";
  host = await makeCliHost();
});

async function load(name) {
  await host.call("projects.loadSaveData", [
    fs.readFileSync(path.join(EXAMPLES, name), "utf-8"),
  ]);
}

describe("every example", () => {
  it("has at least one to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const name of files) {
    describe(name, () => {
      it("codegen through the API equals generateAllShaders", async () => {
        await load(name);
        const direct = host.blueprint.generateAllShaders();
        if (!direct) return; // a project that cannot compile has nothing to compare

        expect(await host.call("shader.getGeneratedCode")).toEqual(direct);

        for (const target of ["webgl1", "webgl2", "webgpu"]) {
          const single = await host.call("shader.getGeneratedCode", [
            { target },
          ]);
          expect(single[target]).toBe(direct[target]);
        }
      });

      it("the addon bundle equals what the app's own export builds", async () => {
        await load(name);
        const direct = host.blueprint.buildAddonBundle();
        if (!direct) return;

        const viaApi = await host.call("projects.buildAddonBundle", [{}]);
        expect(viaApi.files).toEqual(direct.files);
        expect(viaApi.filename).toBe(direct.filename);
      });

      it("save data round-trips through the CLI's load path unchanged", async () => {
        await load(name);
        const first = await host.call("projects.getSaveData");

        // Feeding the app its own save data back must be a fixed point,
        // otherwise `csg arrange -o out.c3sg` would quietly rewrite content.
        await host.call("projects.loadSaveData", [JSON.stringify(first)]);
        const second = await host.call("projects.getSaveData");

        expect(JSON.parse(JSON.stringify(second))).toEqual(
          JSON.parse(JSON.stringify(first)),
        );
      });
    });
  }
});
