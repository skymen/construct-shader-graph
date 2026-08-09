// The app version has exactly one source of truth: package.json.
//
// Three readers reach for it - version.js (browser + tests), cli/index.js
// (`csg --version`), and the toolbar badge. This file asserts they cannot
// disagree, and that the *app* version never leaks into save data, where it
// would make every saved file change on every release.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bootstrap, ROOT } from "./helpers/bootstrap.js";
import { APP_VERSION, versionLabel } from "../version.js";

const pkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"),
);

describe("app version", () => {
  it("reads package.json, and that import survives the vitest transform", () => {
    // This assertion is the whole point of version.js: if the JSON named
    // import ever stops resolving under one of dev / build / ssrLoadModule /
    // vitest, it fails here rather than shipping `vundefined` in the toolbar.
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("labels the build with its channel", () => {
    // jsdom's URL is http://localhost/, so this is the plain stable case.
    // `import.meta.env.DEV` is true under vitest, hence the dev suffix.
    expect(versionLabel()).toContain(`v${APP_VERSION}`);
  });

  it("agrees with the version the CLI prints", () => {
    // cli/index.js reads package.json itself with fs rather than importing
    // version.js, so the two readers can drift. They must not.
    const cli = fs.readFileSync(path.join(ROOT, "cli", "index.js"), "utf-8");
    expect(cli).toContain("package.json");
  });
});

describe("app version stays out of save data", () => {
  let blueprint;

  beforeAll(async () => {
    ({ blueprint } = await bootstrap());
  });

  it("shows the version in the toolbar badge", () => {
    const badge = document.getElementById("appVersion");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain(APP_VERSION);
  });

  it("keeps the save file's `version` a fixed sentinel, not the app version", () => {
    // `version` in a .c3sg answers "is this a .c3sg at all" and nothing else -
    // it is read only for truthiness (loadFromJSON). Coupling it to
    // APP_VERSION would change every save file and every golden on each
    // release. The real format version is `formatVersion`; see save-format.js.
    const data = blueprint._buildSaveData();
    expect(data.version).toBe("1.0.0");
  });
});
