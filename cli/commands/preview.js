import { readProject, dataUrlToBuffer, fileToDataUrl } from "../io.js";
import { CliError, out, err, style, writeFile } from "../io.js";
import { num } from "../args.js";
import { PREVIEW_SETTINGS } from "../../preview-settings.js";

// Every preview setting the app exposes is described once, in
// preview-settings.js. The CLI derives its flags, its usage text and its patch
// from that table, so a new setting reaches `csg preview` for free and the two
// cannot disagree about names or types.
const CLI_SETTINGS = PREVIEW_SETTINGS.filter((d) => d.cli);

const dashed = (flag) => flag.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const HELP_COLUMN = 24;

function flagLine(d) {
  // A boolean is documented in the direction that changes something: a setting
  // the app defaults on is worth turning off (--no-auto-rotate), one it
  // defaults off is worth turning on (--force-rotated-texture). The parser
  // accepts both forms either way; this is only about which one to show.
  const left =
    d.kind === "bool"
      ? `  --${d.default ? "no-" : ""}${dashed(d.cli.flag)}`
      : `  --${dashed(d.cli.flag)} ${d.cli.arg}`;

  // A flag too long for the column gets its help on the next line rather than
  // running the two together.
  return left.length < HELP_COLUMN
    ? `${left.padEnd(HELP_COLUMN)}${d.cli.help}`
    : `${left}\n${" ".repeat(HELP_COLUMN)}${d.cli.help}`;
}

const settingLines = (predicate) =>
  CLI_SETTINGS.filter(predicate).map(flagLine).join("\n");

export const summary = "Render the preview to a PNG (needs Playwright)";
export const usage = `csg preview <file.c3sg> [options]

  -o, --output <f>      PNG to write (default: preview.png)
  --settle <ms>         Wait this long after the shader loads (default: 1500)
  --timeout <ms>        Give up waiting for the preview (default: 60000)

  Preview settings (each maps onto the app's own preview panel):
${settingLines((d) => d.kind !== "texture")}

  Asking for --language webgpu relaunches Chromium on Dawn/SwiftShader, because
  the GL flags would silently serve WebGL2.

  Textures are given as image files and embedded as data URLs:
${settingLines((d) => d.kind === "texture")}

  --headed              Show the browser window
  --keep-open           Leave the browser open after capturing`;

export const booleans = [
  "headed",
  "keepOpen",
  ...CLI_SETTINGS.filter((d) => d.kind === "bool").map((d) => d.cli.flag),
];
export const aliases = { o: "output" };

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

  for (const d of CLI_SETTINGS) {
    const raw = flags[d.cli.flag];
    if (raw === undefined) continue;
    patch[d.key] =
      d.kind === "number"
        ? num(raw, d.cli.flag)
        : d.kind === "bool"
          ? !!raw
          : d.kind === "texture"
            ? fileToDataUrl(raw)
            : raw;
  }

  await host.call("projects.loadSaveData", [readProject(file)]);
  await host.call("preview.updateSettings", [patch]);
  await host.call("preview.clearConsole");

  // A shader that fails to compile never reports ready, so wait for whichever
  // comes first: the preview booting, or the runtime logging the error.
  const timeout =
    flags.timeout !== undefined ? num(flags.timeout, "timeout") : 60000;
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
  const settle =
    flags.settle !== undefined ? num(flags.settle, "settle") : 1500;
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
