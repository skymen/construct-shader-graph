// Render the preview in a real browser and save a PNG.
//
// Because this actually compiles and runs the generated shader, a failure here
// is a genuine compile error, not a lint guess - which is why a bad shader
// exits non-zero rather than writing a broken image.

import { readProject, dataUrlToBuffer, fileToDataUrl } from "../io.js";
import { CliError, out, err, style, writeFile } from "../io.js";
import { num } from "../args.js";

export const summary = "Render the preview to a PNG (needs Playwright)";
export const usage = `csg preview <file.c3sg> [options]

  -o, --output <f>      PNG to write (default: preview.png)
  --settle <ms>         Wait this long after the shader loads (default: 1500)
  --timeout <ms>        Give up waiting for the preview (default: 60000)

  Preview settings (each maps onto the app's own preview panel):
  --language <l>        webgl1 | webgl2 | webgpu   (default: webgl2). Asking
                        for webgpu relaunches Chromium on Dawn/SwiftShader,
                        because the GL flags would silently serve WebGL2.
  --effect-target <t>   sprite | layer | ...
  --object <o>          sprite | box | ...
  --camera <m>          2d | 3d
  --sampling <m>        trilinear | nearest | ...
  --zoom <n>            Zoom level
  --sprite-scale <n>    Sprite scale
  --shape-scale <n>     Shape scale
  --room-scale <n>      Room scale
  --bg-opacity <n>      Background opacity
  --bg3d-opacity <n>    3D background opacity
  --no-auto-rotate      Stop the auto rotation
  --no-background-cube  Hide the background cube
  --force-rotated-texture
                        Pack the frame sideways, as C3 does when spritesheeting
                        rotates it. Reproduces the rotated-source bug class.
  --startup-script <s>  Startup script source

  Textures are given as image files and embedded as data URLs:
  --sprite-texture <f>
  --shape-texture <f>
  --bg-texture <f>

  --headed              Show the browser window
  --keep-open           Leave the browser open after capturing`;

export const booleans = [
  "headed",
  "keepOpen",
  "autoRotate",
  "backgroundCube",
  "forceRotatedTexture",
];
export const aliases = { o: "output" };

// CLI flag -> previewSettings key. The app validates the values, so this table
// only has to name them.
const SETTING_FLAGS = {
  language: "shaderLanguage",
  effectTarget: "effectTarget",
  object: "object",
  camera: "cameraMode",
  sampling: "samplingMode",
  startupScript: "startupScript",
};

const NUMERIC_FLAGS = {
  zoom: "zoomLevel",
  spriteScale: "spriteScale",
  shapeScale: "shapeScale",
  roomScale: "roomScale",
  bgOpacity: "bgOpacity",
  bg3dOpacity: "bg3dOpacity",
};

const TEXTURE_FLAGS = {
  spriteTexture: "spriteTextureUrl",
  shapeTexture: "shapeTextureUrl",
  bgTexture: "bgTextureUrl",
};

function reportErrors(errors) {
  for (const entry of errors) {
    const text = entry.message || entry.text || String(entry);
    err(`${style.red("shader error")}  ${text.replace(/\0/g, "").trim()}`);
  }
  return 1;
}

export async function run({ host, args, flags }) {
  const file = args[0];
  if (!file) throw new CliError("A .c3sg file is required");

  const patch = {
    // Headless Chromium's WebGPU support is not dependable; the app's default
    // is webgpu, so pin it unless the caller says otherwise.
    shaderLanguage: "webgl2",
  };

  for (const [flag, key] of Object.entries(SETTING_FLAGS)) {
    if (flags[flag] !== undefined) patch[key] = flags[flag];
  }
  for (const [flag, key] of Object.entries(NUMERIC_FLAGS)) {
    if (flags[flag] !== undefined) patch[key] = num(flags[flag], flag);
  }
  for (const [flag, key] of Object.entries(TEXTURE_FLAGS)) {
    if (flags[flag] !== undefined) patch[key] = fileToDataUrl(flags[flag]);
  }
  if (flags.autoRotate !== undefined) patch.autoRotate = !!flags.autoRotate;
  if (flags.backgroundCube !== undefined) {
    patch.showBackgroundCube = !!flags.backgroundCube;
  }
  if (flags.forceRotatedTexture !== undefined) {
    patch.forceRotatedTexture = !!flags.forceRotatedTexture;
  }

  await host.call("projects.loadSaveData", [readProject(file)]);
  await host.call("preview.updateSettings", [patch]);
  await host.call("preview.clearConsole");

  // A shader that fails to compile never reports ready, so wait for whichever
  // comes first: the preview booting, or the runtime logging the error.
  const timeout = flags.timeout !== undefined ? num(flags.timeout, "timeout") : 60000;
  const deadline = Date.now() + timeout;
  let ready = false;
  while (Date.now() < deadline) {
    const errors = await host.call("preview.getErrors", [{ limit: 20 }]);
    if (errors.length > 0) return reportErrors(errors);
    if (await host.isPreviewReady()) {
      ready = true;
      break;
    }
    await host.sleep(250);
  }
  if (!ready) {
    throw new CliError(
      `The preview did not become ready within ${timeout}ms and reported no error. Raise --timeout, or run with --headed to watch it.`,
    );
  }

  // The runtime needs a beat to compile the shader and draw a frame.
  const settle = flags.settle !== undefined ? num(flags.settle, "settle") : 1500;
  await host.sleep(settle);

  const errors = await host.call("preview.getErrors", [{ limit: 20 }]);
  if (errors.length > 0) return reportErrors(errors);

  const shot = await host.call("preview.screenshot", [{ download: false }]);
  if (!shot?.dataUrl) {
    throw new CliError(
      "The preview did not return an image. Try raising --settle.",
    );
  }

  const output = flags.output || "preview.png";
  writeFile(output, dataUrlToBuffer(shot.dataUrl));
  out(
    `${style.green("ok")}  wrote ${output} ${style.dim(`(${patch.shaderLanguage})`)}`,
  );

  if (flags.keepOpen) {
    out(style.dim("browser left open - press Ctrl+C to quit"));
    await new Promise(() => {});
  }

  return 0;
}
