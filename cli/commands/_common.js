// Shared plumbing for commands. Everything here is transport: load bytes into
// the app, take the app's own save data back out. No graph logic.

import { CliError, readProject, writeProject } from "../io.js";

// The gallery thumbnail is captured live off the preview iframe, which no
// headless host has. getSaveData therefore never returns one, so writing a
// project back would quietly strip whatever the app had saved. Carry it across
// from the file we read instead - it is the one piece of the save data the CLI
// cannot regenerate.
const lastLoadedScreenshot = new Map();

export async function loadProject(host, file) {
  if (!file) throw new CliError("A .c3sg file is required");
  const body = readProject(file);
  let screenshot = null;
  try {
    screenshot = JSON.parse(body)?.previewScreenshot ?? null;
  } catch {
    // Not our problem here - loadSaveData reports a malformed project.
  }
  lastLoadedScreenshot.set(host, screenshot);
  await host.call("projects.loadSaveData", [body]);
  return file;
}

export async function saveProject(host, file) {
  const data = await host.call("projects.getSaveData");
  const screenshot = lastLoadedScreenshot.get(host);
  if (screenshot && !data.previewScreenshot) {
    data.previewScreenshot = screenshot;
  }
  writeProject(file, data);
  return file;
}

/**
 * Resolve where a mutating command should write. `--in-place` writes back over
 * the input; `-o` writes elsewhere; neither means the command is read-only and
 * should say so rather than silently discarding the result.
 */
export function resolveOutput(inputFile, flags, { verb }) {
  if (flags.inPlace) return inputFile;
  if (flags.output) return flags.output;
  throw new CliError(
    `${verb} changes the project - pass --in-place to overwrite ${inputFile}, or -o <file> to write a copy`,
  );
}
