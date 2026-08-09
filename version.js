// package.json is the single source of truth for the app version. Vite's JSON
// plugin gives it a named export identically in dev, `vite build`, jsdom/vitest
// and `ssrLoadModule`, so the browser, the CLI and the tests all agree on one
// number with no build config and no generated file to go stale.
//
// Deliberately NOT a `define` in vite.config.js: a define reaches those four
// contexts by three different mechanisms (a dev-time globalThis assignment from
// @vite/client, an undocumented Vitest internal, and real textual replacement
// only on the SSR path). This repo already hit that trap once - see commit
// 7424c04, "Vite's import.meta.env replacement clobbers the define".
//
// This is the *app* version. It is not the save-file format version
// (SAVE_FORMAT_VERSION in save-format.js) and not the exported Construct addon
// version (shaderSettings.version, a 4-part string the user bumps on export).
import { version } from "./package.json";

export const APP_VERSION = version;

/** True on the deployed experimental channel (/construct-shader-graph/experimental/). */
export function isExperimentalBuild() {
  if (typeof window === "undefined") return false;
  const path = window.location?.pathname || "";
  return path.endsWith("/experimental/") || path.endsWith("/experimental");
}

/**
 * "v1.0.0", plus which channel it came from. Answers issue #88's "in case
 * we're running it locally" - a local dev build and the deployed stable build
 * report the same package.json version, so the suffix is the only thing that
 * tells them apart.
 */
export function versionLabel() {
  let channel = "";
  if (import.meta.env?.DEV) channel = " dev";
  else if (isExperimentalBuild()) channel = " experimental";
  return `v${APP_VERSION}${channel}`;
}
