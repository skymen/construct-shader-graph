// Headless host: jsdom + Vite's SSR module loader.
//
// script.js imports `virtual:examples` and `./shaders/*.glsl?raw`, so it can
// only be loaded through Vite. Running it via ssrLoadModule against the repo's
// own vite.config.js means the CLI resolves modules exactly the way the app
// and the test suite do - there is no second build pipeline to keep in sync.
//
// Everything except `preview` runs here. See cli/host/browser.js for the rest.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

let started = null;

async function installDom() {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });

  const { window } = dom;

  const define = (key, value) => {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };

  define("window", window);
  define("document", window.document);
  define("navigator", window.navigator);
  define("self", window);

  // Mirror the window's remaining properties onto globalThis so bare
  // references in script.js (HTMLCanvasElement, CustomEvent, ...) resolve.
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    try {
      Object.defineProperty(globalThis, key, {
        get: () => window[key],
        configurable: true,
      });
    } catch {
      // Some window properties are not redefinable; they are not ones we need.
    }
  }

  const { installDomStubs } = await import("../../headless/dom-stubs.js");
  installDomStubs(window, globalThis);

  return window;
}

/**
 * Boot the app headlessly. Returns a host with the same `call` interface the
 * browser host exposes, plus direct handles for `run`/`repl`.
 */
export async function createNodeHost({ quiet = true } = {}) {
  if (started) return started;

  started = (async () => {
    await installDom();

    if (quiet) {
      // script.js is chatty on construct and during codegen; the CLI's own
      // output is the product, so keep stdout clean unless asked otherwise.
      console.log = () => {};
      console.info = () => {};
      console.debug = () => {};
    }

    const { createServer } = await import("vite");
    const server = await createServer({
      configFile: path.join(ROOT, "vite.config.js"),
      root: ROOT,
      appType: "custom",
      server: { middlewareMode: true, hmr: false, watch: null },
      logLevel: "error",
    });

    const { boot } = await server.ssrLoadModule("/headless/boot.js");
    const booted = await boot();

    return {
      kind: "node",
      api: booted.api,
      get blueprint() {
        return booted.blueprint;
      },
      NODE_TYPES: booted.NODE_TYPES,
      Wire: booted.Wire,

      async call(methodPath, args = []) {
        return booted.api.call(methodPath, args);
      },

      manifest() {
        return booted.api.getManifest();
      },

      // Zip a bundle from projects.buildAddonBundle using the app's own JSZip,
      // so the CLI's .c3addon and the download button's are built identically.
      zipBundle(bundle, type = "uint8array") {
        return booted.blueprint.zipAddonBundle(bundle, type);
      },

      async close() {
        await server.close();
      },
    };
  })();

  return started;
}
