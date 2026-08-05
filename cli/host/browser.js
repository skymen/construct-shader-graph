// Browser host: a real Chromium driving the real app.
//
// The preview is a full Construct 3 runtime in an iframe, so it needs an actual
// GPU context and cannot run under jsdom. Rather than reimplement any of it,
// this host serves the app with the repo's own Vite config and drives the page
// through the same shaderGraphAPI the node host calls in-process -
// page.evaluate(sg.call(path, args)) is the only difference.
//
// Side benefit: this compiles the generated shaders for real, on all three
// backends, which the jsdom host cannot do.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "../io.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const INSTALL_HINT = `The preview command needs Playwright's Chromium.

  npm install --save-optional playwright
  npx playwright install chromium

Every other command runs headlessly and needs none of this.`;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new CliError(INSTALL_HINT);
  }
}

export async function createBrowserHost({ flags = {} } = {}) {
  const { chromium } = await loadPlaywright();
  const { createServer } = await import("vite");

  const server = await createServer({
    configFile: path.join(ROOT, "vite.config.js"),
    root: ROOT,
    server: { port: 0, host: "127.0.0.1", open: false, hmr: false },
    logLevel: "error",
  });
  await server.listen();

  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/`;

  // WebGL and WebGPU need different browsers, and getting this wrong is silent:
  // asking C3 for WebGPU when no usable adapter exists does not error, it just
  // renders on WebGL2 and still reports success - so a WebGPU-only bug looks
  // fixed when it was never exercised.
  //
  // For WebGL the ANGLE/SwiftShader flags give a deterministic software GL.
  // For WebGPU software is not an option: SwiftShader reports
  // isFallbackAdapter, and C3 rejects fallback adapters outright
  // ("renderer-unavailable (WebGPU provided fallback adapter)") then quietly
  // takes the WebGL path. So WebGPU needs a real adapter - installed Chrome,
  // which serves one even headless, or failing that the bundled Chromium with
  // a window open, which is the only way it reaches the GPU.
  const wantsWebGPU = flags.language === "webgpu";
  const headless = flags.headed ? false : true;
  const attempts = wantsWebGPU
    ? [
        { channel: "chrome", headless, args: ["--enable-unsafe-webgpu"] },
        { headless: false, args: ["--enable-unsafe-webgpu"] },
      ]
    : [
        {
          headless,
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      ];

  let browser;
  let launchError;
  for (const attempt of attempts) {
    try {
      browser = await chromium.launch({
        ...attempt,
        args: [...attempt.args, "--disable-dev-shm-usage"],
      });
      break;
    } catch (error) {
      launchError = error;
    }
  }
  if (!browser) {
    await server.close();
    throw new CliError(`${INSTALL_HINT}\n\n(${launchError.message})`);
  }

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  if (flags.verbose) {
    page.on("console", (msg) => process.stderr.write(`[page] ${msg.text()}\n`));
  }

  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => !!globalThis.shaderGraphAPI, null, {
    timeout: 60000,
  });

  return {
    kind: "browser",
    page,
    url,
    pageErrors,

    async call(methodPath, args = []) {
      return page.evaluate(
        ([p, a]) => globalThis.shaderGraphAPI.call(p, a),
        [methodPath, args],
      );
    },

    async manifest() {
      return page.evaluate(() => globalThis.shaderGraphAPI.getManifest());
    },

    async isPreviewReady() {
      return page.evaluate(() => globalThis.__bp?.previewReady === true);
    },

    async sleep(ms) {
      await page.waitForTimeout(ms);
    },

    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      await server.close().catch(() => {});
    },
  };
}
