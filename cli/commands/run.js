// Run an arbitrary script against a live app instance. This is the escape
// hatch that replaces hand-rolled vitest harnesses for one-off graph surgery:
// the script gets the same `sg` object the browser console has.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadProject, saveProject } from "./_common.js";
import { CliError, out, style, printJson } from "../io.js";

export const summary = "Run a JS script against a project";
export const usage = `csg run <script.js> <file.c3sg> [options]
csg run -e "<expression>" <file.c3sg> [options]

  -e, --eval <src>  Run an inline expression instead of a script file
  --write           Save the project back afterwards
  -o, --output <f>  Save to <f> instead of over the input
  -f, --force       Write even if loading dropped unknown node types
  --json            Print the script's return value as JSON

The script is called with one argument:
  { sg, api, blueprint, NODE_TYPES, Wire, file }
'sg' and 'api' are the same shaderGraphAPI the browser console exposes.
A default-exported function is awaited; a bare module body just runs.`;
export const booleans = ["write", "json"];
export const aliases = { o: "output", e: "eval" };

export async function run({ host, args, flags }) {
  const scriptArg = flags.eval ? null : args[0];
  const projectFile = flags.eval ? args[0] : args[1];

  if (!flags.eval && !scriptArg) {
    throw new CliError("A script file or --eval expression is required");
  }
  await loadProject(host, projectFile);

  const context = {
    sg: host.api,
    api: host.api,
    blueprint: host.blueprint,
    NODE_TYPES: host.NODE_TYPES,
    Wire: host.Wire,
    file: projectFile,
  };

  let result;
  if (flags.eval) {
    const fn = new (Object.getPrototypeOf(async function () {}).constructor)(
      "ctx",
      `const { sg, api, blueprint, NODE_TYPES, Wire, file } = ctx; return (${flags.eval});`,
    );
    result = await fn(context);
  } else {
    const mod = await import(pathToFileURL(path.resolve(scriptArg)).href);
    if (typeof mod.default === "function") {
      result = await mod.default(context);
    } else {
      result = mod.default;
    }
  }

  if (flags.write || flags.output) {
    const target = flags.output || projectFile;
    await saveProject(host, target, flags);
    out(`${style.green("ok")}  wrote ${target}`);
  }

  if (result !== undefined) {
    if (flags.json) printJson(result);
    else out(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  }

  return 0;
}
