// Golden-file compare helper for shader codegen tests.
//
// Usage inside a Vitest test:
//   import { compareGolden } from "./helpers/golden.js";
//   compareGolden("passthrough-uv", shaders);
//
// The `shaders` argument is the { webgl1, webgl2, webgpu } object returned
// by blueprint.generateAllShaders(). Each target is compared byte-for-byte
// against tests/golden/<name>.<ext>, where the extension is `.glsl` for
// webgl1/webgl2 and `.wgsl` for webgpu.
//
// First-run / intentional regeneration: set UPDATE_GOLDEN=1 in the env to
// write the current output to disk instead of comparing. Review the diff in
// git before committing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(__dirname, "..", "golden");

const EXT = {
  webgl1: "glsl",
  webgl2: "glsl",
  webgpu: "wgsl",
};

function goldenPath(name, target) {
  return path.join(GOLDEN_DIR, `${name}.${target}.${EXT[target]}`);
}

function ensureDir() {
  if (!fs.existsSync(GOLDEN_DIR)) fs.mkdirSync(GOLDEN_DIR, { recursive: true });
}

export function compareGolden(name, shaders, { targets = ["webgl1", "webgl2", "webgpu"] } = {}) {
  ensureDir();
  const update = process.env.UPDATE_GOLDEN === "1";

  for (const target of targets) {
    const file = goldenPath(name, target);
    const actual = shaders[target];
    if (typeof actual !== "string") {
      throw new Error(`[golden:${name}] shaders.${target} is not a string`);
    }

    if (update || !fs.existsSync(file)) {
      fs.writeFileSync(file, actual, "utf-8");
      // On first-write or update, assert trivially so the test still passes.
      expect(actual).toBe(actual);
      continue;
    }

    const expected = fs.readFileSync(file, "utf-8");
    // Using toBe for a clean diff in Vitest output.
    expect(actual, `golden mismatch: ${path.relative(path.resolve(__dirname, "..", ".."), file)} (rerun with UPDATE_GOLDEN=1 to refresh)`).toBe(expected);
  }
}
