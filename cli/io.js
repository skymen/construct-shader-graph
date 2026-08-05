// File and console plumbing. The CLI's only job beyond dispatching to the API
// is reading bytes in and writing bytes out, so all of that lives here.

import fs from "node:fs";
import path from "node:path";

export class CliError extends Error {}

export function readProject(file) {
  if (!fs.existsSync(file)) {
    throw new CliError(`No such file: ${file}`);
  }
  return fs.readFileSync(file, "utf-8");
}

export function writeProject(file, saveData) {
  ensureDir(path.dirname(path.resolve(file)));
  fs.writeFileSync(file, JSON.stringify(saveData, null, 2));
}

export function ensureDir(dir) {
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeFile(file, content) {
  ensureDir(path.dirname(path.resolve(file)));
  fs.writeFileSync(file, content);
}

// Read an image and return it as a data URL, which is exactly the shape the
// app stores texture selections in (previewSettings.*TextureUrl).
export function fileToDataUrl(file) {
  if (!fs.existsSync(file)) {
    throw new CliError(`No such file: ${file}`);
  }
  const ext = path.extname(file).toLowerCase().replace(".", "");
  const mime =
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      bmp: "image/bmp",
    }[ext] || "application/octet-stream";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl) {
  const comma = String(dataUrl).indexOf(",");
  if (comma === -1) throw new CliError("Malformed data URL");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

// --- output ------------------------------------------------------------------

const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const wrap = (code) => (s) => (useColor ? `[${code}m${s}[0m` : s);
export const style = {
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};

// CSG_QUIET suppresses the human-readable chatter. Set by the test suite,
// which drives the command modules directly and asserts on files, not text.
const quiet = () => !!process.env.CSG_QUIET;

export function out(line = "") {
  if (quiet()) return;
  process.stdout.write(`${line}\n`);
}

export function err(line = "") {
  if (quiet()) return;
  process.stderr.write(`${line}\n`);
}

export function printJson(value) {
  out(JSON.stringify(value, null, 2));
}

export function shaderFilename(target) {
  return {
    webgl1: "effect.fx",
    webgl2: "effect.webgl2.fx",
    webgpu: "effect.wgsl",
  }[target];
}

export const SHADER_TARGETS = ["webgl1", "webgl2", "webgpu"];
