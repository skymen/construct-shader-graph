// The CLI's half of the unknown-node-type guard.
//
// The app can afford to only warn: a human sees the notification and can close
// without saving. The CLI cannot - `csg arrange --in-place` in a script would
// hand the shrunken graph straight back to disk with nobody watching, and the
// node and its wires are then gone for good. So here a lossy load is an error
// from `validate` and a hard refusal from anything that writes, overridable
// with -f for the case where dropping really is what you meant.
//
// See tests/46-unknown-node-type-load.test.js for the app-side notification.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeCliHost } from "./helpers/cli-host.js";
import { ROOT } from "../headless/boot.js";

const SOURCE = path.join(ROOT, "examples", "uv bulge.c3sg");

let host;
let tmp;

beforeAll(async () => {
  process.env.CSG_QUIET = "1";
  host = await makeCliHost();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csg-unknown-"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function runCommand(name, args, flags = {}) {
  const mod = await import(`../cli/commands/${name}.js`);
  return mod.run({ host, args, flags });
}

// Copy an example and rename one node type so the loader cannot resolve it.
// Returns the path plus the counts the file started with.
function brokenCopy(name) {
  const data = JSON.parse(fs.readFileSync(SOURCE, "utf-8"));
  const target = data.nodes.find((n) => n.nodeTypeKey === "bulge");
  expect(target, "fixture should contain a bulge node").toBeDefined();
  target.nodeTypeKey = "bulgeRENAMED";

  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return { file, nodes: data.nodes.length, wires: data.wires.length };
}

function counts(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return { nodes: data.nodes.length, wires: data.wires.length };
}

describe("csg validate", () => {
  it("fails on a project with an unknown node type", async () => {
    const { file } = brokenCopy("validate-broken.c3sg");
    await runCommand("validate", [file]);

    const result = await host.call("graph.validate");
    expect(result.ok).toBe(false);
    const loadError = result.errors.find((e) => e.source === "load");
    expect(loadError, JSON.stringify(result.errors)).toBeDefined();
    expect(loadError.message).toContain("bulgeRENAMED");
    expect(loadError.unknownNodeTypes).toEqual(["bulgeRENAMED"]);
  });

  it("returns a non-zero exit code", async () => {
    const { file } = brokenCopy("validate-exit.c3sg");
    expect(await runCommand("validate", [file])).toBe(1);
  });

  it("still passes a healthy project", async () => {
    const file = path.join(tmp, "healthy.c3sg");
    fs.copyFileSync(SOURCE, file);
    expect(await runCommand("validate", [file])).toBe(0);

    const result = await host.call("graph.validate");
    expect(result.errors.filter((e) => e.source === "load")).toEqual([]);
  });
});

describe("writing a project that lost nodes on load", () => {
  it("is refused, and leaves the file untouched", async () => {
    const { file, nodes, wires } = brokenCopy("arrange-refused.c3sg");

    await expect(
      runCommand("arrange", [file], { inPlace: true }),
    ).rejects.toThrow(/refusing to write/i);

    // The point of the refusal: the file on disk is exactly as it was.
    expect(counts(file)).toEqual({ nodes, wires });
  });

  it("names what would have been lost", async () => {
    const { file } = brokenCopy("arrange-message.c3sg");

    await expect(
      runCommand("arrange", [file], { inPlace: true }),
    ).rejects.toThrow(/bulgeRENAMED/);
  });

  it("goes through with -f, and the loss is real", async () => {
    const { file, nodes } = brokenCopy("arrange-forced.c3sg");

    expect(await runCommand("arrange", [file], { inPlace: true, force: true })).toBe(
      0,
    );
    expect(counts(file).nodes).toBe(nodes - 1);
  });

  it("does not block a healthy project", async () => {
    const file = path.join(tmp, "arrange-healthy.c3sg");
    fs.copyFileSync(SOURCE, file);
    const before = counts(file);

    expect(await runCommand("arrange", [file], { inPlace: true })).toBe(0);
    expect(counts(file)).toEqual(before);
  });

  it("does not leak the refusal into the next healthy load", async () => {
    // The guard is keyed per host, so a lossy load followed by a clean one must
    // not keep the clean project blocked.
    const { file: broken } = brokenCopy("leak-broken.c3sg");
    await expect(
      runCommand("arrange", [broken], { inPlace: true }),
    ).rejects.toThrow(/refusing to write/i);

    const clean = path.join(tmp, "leak-clean.c3sg");
    fs.copyFileSync(SOURCE, clean);
    expect(await runCommand("arrange", [clean], { inPlace: true })).toBe(0);
  });
});
