// Bootstraps the real BlueprintSystem inside jsdom by loading index.html
// and importing script.js. Returns { blueprint, api, Wire, NODE_TYPES }.
//
// Usage in a test file:
//   import { bootstrap } from "./helpers/bootstrap.js";
//   const { blueprint } = await bootstrap();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

let bootedPromise = null;

export async function bootstrap() {
  if (bootedPromise) return bootedPromise;
  bootedPromise = (async () => {
    // Mount the real index.html body into jsdom so all DOM IDs exist.
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);

    if (headMatch) {
      // Strip <script> and <link rel=stylesheet> so jsdom doesn't try to fetch.
      const headHtml = headMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<link[^>]*>/gi, "");
      document.head.innerHTML = headHtml;
    }
    if (bodyMatch) {
      const bodyHtml = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "");
      document.body.innerHTML = bodyHtml;
    }

    // script.js bootstraps on import: const blueprint = new BlueprintSystem(canvas);
    // We need to import it AFTER the DOM is mounted.
    await import("../../script.js");

    const api = globalThis.shaderGraphAPI;
    if (!api) throw new Error("shaderGraphAPI not installed after import");
    // Reach the BlueprintSystem instance via the API closure-bound helpers:
    // the API exposes the blueprint indirectly. We need direct access for tests.
    // It's not exported directly; api.graph.* takes implicit blueprint.
    // We expose it from script.js via globalThis below as a side-channel.
    if (!globalThis.__bp) {
      // script.js doesn't expose blueprint; install via api.session if present,
      // otherwise reach in through ShaderGraphNode's static reference path.
      // Fallback: dig from API internals — the api object closes over `bp`.
      // We can read the canvas's onmousedown handler binding, but the cleanest
      // is to expose via an api method if present.
    }

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
