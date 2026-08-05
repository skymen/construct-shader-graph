// The preview's anti-drift guard.
//
// `preview/` is a Construct 3 web export; `preview-src/` is the project it came
// from. Construct copies script files verbatim on export, so the two copies of
// the preview's runtime script must be byte-identical. Edit only the export and
// the next re-export silently deletes the work - which is exactly what happened
// to the forceRotatedTexture block before the source project was brought in.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../headless/boot.js";
import { PREVIEW_SETTINGS } from "../preview-settings.js";

const SOURCE = path.join(ROOT, "preview-src", "scripts", "main.js");
const EXPORT = path.join(ROOT, "preview", "scripts", "project", "main.js");

describe("preview source parity", () => {
  it("keeps preview-src/scripts/main.js and the export byte-identical", () => {
    const source = fs.readFileSync(SOURCE, "utf-8");
    const exported = fs.readFileSync(EXPORT, "utf-8");

    // Compared as text so a failure prints the offending lines rather than a
    // buffer length.
    expect(exported).toBe(source);
  });

  it("keeps the Construct project's script manifest pointing at that one file", () => {
    // If the project ever gains a second script file, the check above stops
    // covering the whole preview and this is the reminder to extend it.
    const project = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "preview-src", "project.c3proj"),
        "utf-8",
      ),
    );
    const scripts = project.rootFileFolders.script;

    expect(scripts.items.map((item) => item.name)).toEqual(["main.js"]);
    expect(scripts.subfolders).toEqual([]);
  });

  it("implements every command the settings table sends", () => {
    // The failure this catches is silent at runtime: the host posts a command
    // the preview has no handler for, the preview drops it, and the control
    // just does nothing. Renaming a command on one side only did exactly that.
    const source = fs.readFileSync(SOURCE, "utf-8");
    const table = source.slice(
      source.indexOf("const PREVIEW_COMMANDS = {"),
      source.indexOf("function handlePreviewCommand"),
    );
    expect(table, "PREVIEW_COMMANDS table not found").toBeTruthy();

    const handled = new Set(
      [...table.matchAll(/^\s{2}(\w+)[,:]/gm)].map((m) => m[1]),
    );
    const wanted = [
      ...new Set(PREVIEW_SETTINGS.map((d) => d.command).filter(Boolean)),
    ];

    expect(wanted.length).toBeGreaterThanOrEqual(10);
    expect(wanted.filter((command) => !handled.has(command))).toEqual([]);
  });
});
