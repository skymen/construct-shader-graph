// Shared plumbing for commands. Everything here is transport: load bytes into
// the app, take the app's own save data back out. No graph logic.

import { CliError, readProject, writeProject } from "../io.js";

// The gallery thumbnail is captured live off the preview iframe, which no
// headless host has. getSaveData therefore never returns one, so writing a
// project back would quietly strip whatever the app had saved. Carry it across
// from the file we read instead - it is the one piece of the save data the CLI
// cannot regenerate.
const lastLoadedScreenshot = new Map();

// A node type the app cannot resolve is dropped on load, and so is every wire
// touching it. In the app that is survivable - you see a notification and can
// close without saving. Here the next --write would hand the shrunken graph
// straight back to disk unattended, so we remember what was lost and refuse.
const lastLoadLoss = new Map();

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
  const result = await host.call("projects.loadSaveData", [body]);
  lastLoadLoss.set(host, {
    unknownNodeTypes: result?.unknownNodeTypes ?? [],
    droppedWires: result?.droppedWires ?? 0,
  });
  return file;
}

export async function saveProject(host, file, flags = {}) {
  const loss = lastLoadLoss.get(host);
  if (loss && loss.unknownNodeTypes.length > 0 && !flags.force) {
    const wires = loss.droppedWires;
    const wireNote =
      wires > 0
        ? ` and ${wires} connection${wires === 1 ? "" : "s"}`
        : "";
    throw new CliError(
      `refusing to write: loading dropped ${loss.unknownNodeTypes.length} node type${loss.unknownNodeTypes.length === 1 ? "" : "s"}${wireNote}\n` +
        `  unknown: ${loss.unknownNodeTypes.join(", ")}\n` +
        `  writing now would make that permanent - pass -f to do it anyway`,
    );
  }
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
