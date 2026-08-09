// Boots the real BlueprintSystem outside a browser by mounting index.html into
// jsdom and importing script.js. Everything that is not the preview runs here:
// the graph model, codegen, layout, export and the whole console API are plain
// JS with no GPU involvement.
//
// This is shared by the test harness (tests/helpers/bootstrap.js) and the CLI
// (cli/host/node.js) so there is exactly one place that knows how to stand the
// app up headlessly.
//
// The preview is the one thing that cannot run here: it is a full Construct 3
// runtime in an iframe and needs a real GPU context. See cli/host/browser.js.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

let bootedPromise = null;

/**
 * Mount index.html into the ambient jsdom document and import script.js.
 * Idempotent: repeated calls return the same instance, because script.js
 * constructs its BlueprintSystem once at import time.
 *
 * @returns {Promise<{blueprint: object, api: object, Wire: Function, NODE_TYPES: object}>}
 */
export async function boot() {
  if (bootedPromise) return bootedPromise;
  bootedPromise = (async () => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);

    // Strip <script> and <link rel=stylesheet> so jsdom doesn't try to fetch.
    if (headMatch) {
      document.head.innerHTML = headMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<link[^>]*>/gi, "");
    }
    if (bodyMatch) {
      document.body.innerHTML = bodyMatch[1].replace(
        /<script[\s\S]*?<\/script>/gi,
        "",
      );
    }

    // script.js bootstraps on import: `new BlueprintSystem(canvas)`, so the DOM
    // has to be in place first.
    await import("../script.js");

    const api = globalThis.shaderGraphAPI;
    if (!api) throw new Error("shaderGraphAPI not installed after import");

    return {
      api,
      Wire: globalThis.__sgWire,
      NODE_TYPES: globalThis.__sgNodeTypes,
      get blueprint() {
        return globalThis.__bp;
      },
    };
  })();
  return bootedPromise;
}
