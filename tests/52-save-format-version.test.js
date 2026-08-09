// The .c3sg format version contract (issue #94).
//
// The design is deliberately minimal: the migration table is empty, because
// every format change so far has been additive and the loader handles those by
// sniffing shape. What the version buys is the one thing sniffing cannot do -
// noticing a file from a *newer* build, which would otherwise load silently and
// lose its unrecognised fields on the next save.
//
// So these tests guard two things: that existing files (which have no
// formatVersion at all) keep loading clean, and that the forward guard fires.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bootstrap, ROOT } from "./helpers/bootstrap.js";
import {
  SAVE_FORMAT_VERSION,
  SAVE_MIGRATIONS,
  applySaveMigrations,
  saveFormatOf,
} from "../save-format.js";

const load = (blueprint, data) =>
  blueprint.loadFromJSON({ text: async () => JSON.stringify(data) });

describe("save format constants", () => {
  it("has no migrations, and an inert migration runner", () => {
    // Asserted so that adding a migration is a deliberate act that forces
    // someone to come here and write the row for it.
    expect(Object.keys(SAVE_MIGRATIONS)).toEqual([]);
    const data = { version: "1.0.0", formatVersion: 1 };
    expect(applySaveMigrations(data, 1)).toBe(0);
    expect(data).toEqual({ version: "1.0.0", formatVersion: 1 });
  });

  it("treats a file with no formatVersion as format 1", () => {
    // Every file written before this existed - including every example in the
    // repo - is in this state.
    expect(saveFormatOf({})).toBe(1);
    expect(saveFormatOf({ formatVersion: undefined })).toBe(1);
    expect(saveFormatOf({ formatVersion: "banana" })).toBe(1);
    expect(saveFormatOf({ formatVersion: 0 })).toBe(1);
    expect(saveFormatOf({ formatVersion: 7 })).toBe(7);
  });
});

describe("save format round-trip", () => {
  let blueprint;

  beforeAll(async () => {
    ({ blueprint } = await bootstrap());
  });

  it("stamps the current format onto every save", () => {
    expect(blueprint._buildSaveData().formatVersion).toBe(SAVE_FORMAT_VERSION);
  });

  it("keeps the sentinel and the format version as separate fields", () => {
    const data = blueprint._buildSaveData();
    expect(data.version).toBe("1.0.0");
    expect(typeof data.formatVersion).toBe("number");
  });

  it("survives a save/load round-trip", async () => {
    const saved = blueprint._buildSaveData();
    await load(blueprint, saved);
    expect(blueprint.lastLoadReport.newerFormatVersion).toBeNull();
    expect(blueprint._buildSaveData().formatVersion).toBe(SAVE_FORMAT_VERSION);
  });

  it("loads a file written before formatVersion existed, with no warning", async () => {
    const saved = blueprint._buildSaveData();
    delete saved.formatVersion;

    await load(blueprint, saved);

    expect(blueprint.lastLoadReport.newerFormatVersion).toBeNull();
    expect(blueprint.lastLoadReport.unknownNodeTypes).toEqual([]);
    expect(blueprint.nodes.length).toBeGreaterThan(0);
  });

  it("loads every checked-in example with no format warning", async () => {
    // The real corpus. If the guard ever fires on a file the repo ships, it is
    // the guard that is wrong.
    const dir = path.join(ROOT, "examples");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".c3sg"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      await load(blueprint, data);
      expect(
        blueprint.lastLoadReport.newerFormatVersion,
        `${file} tripped the newer-format guard`,
      ).toBeNull();
    }
  });

  it("warns but still opens a file from a newer build", async () => {
    const saved = blueprint._buildSaveData();
    saved.formatVersion = SAVE_FORMAT_VERSION + 98;

    await load(blueprint, saved);

    expect(blueprint.lastLoadReport.newerFormatVersion).toBe(
      SAVE_FORMAT_VERSION + 98,
    );
    // Opened, not refused - the tolerant loader usually copes, and refusing
    // would strand the file entirely.
    expect(blueprint.nodes.length).toBeGreaterThan(0);
  });

  it("clears a stale warning when a new file is created", async () => {
    const saved = blueprint._buildSaveData();
    saved.formatVersion = SAVE_FORMAT_VERSION + 1;
    await load(blueprint, saved);
    expect(blueprint.lastLoadReport.newerFormatVersion).toBe(
      SAVE_FORMAT_VERSION + 1,
    );

    blueprint.createNewFile();
    expect(blueprint.lastLoadReport.newerFormatVersion).toBeNull();
  });
});

describe("the API hands the format warning to headless callers", () => {
  let api;

  beforeAll(async () => {
    ({ api } = await bootstrap());
  });

  it("reports newerFormatVersion from projects.loadSaveData", async () => {
    const saved = await api.call("projects.getSaveData");

    const clean = await api.call("projects.loadSaveData", [
      JSON.stringify(saved),
    ]);
    expect(clean.newerFormatVersion).toBeNull();

    const newer = await api.call("projects.loadSaveData", [
      JSON.stringify({ ...saved, formatVersion: SAVE_FORMAT_VERSION + 5 }),
    ]);
    // This is what makes `csg` refuse to write over the file - the CLI has no
    // DOM and would never see the notification.
    expect(newer.newerFormatVersion).toBe(SAVE_FORMAT_VERSION + 5);
  });
});
