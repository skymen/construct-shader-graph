// Direct access to every shaderGraphAPI method. The command surface here is
// generated from api.getManifest(), so a method added to GlobalConsoleApi.js
// is reachable from the CLI immediately with no code written here.

import { loadProject, saveProject } from "./_common.js";
import { CliError, out, style, printJson } from "../io.js";

export const summary = "Call any shaderGraphAPI method directly";
export const usage = `csg api <method> [json-args] [options]
csg api --list [filter]

  -f, --file <f>    Load a .c3sg first
  --write           Save the project back after the call
  -o, --output <f>  Save to <f> instead of over the input

json-args is a JSON array of arguments, or a bare JSON object for a
single-argument method. Examples:

  csg api graphs.list -f shader.c3sg
  csg api nodes.search '{"query":"noise"}' -f shader.c3sg
  csg api layout.autoArrange '[{"allGraphs":true}]' -f shader.c3sg --write`;
export const booleans = ["list", "write"];
export const aliases = { f: "file", o: "output", l: "list" };

export async function run({ host, args, flags }) {
  const manifest = host.manifest();

  if (flags.list) {
    const filter = (args[0] || "").toLowerCase();
    const methods = manifest.methods.filter(
      (method) =>
        !filter ||
        method.path.toLowerCase().includes(filter) ||
        (method.description || "").toLowerCase().includes(filter),
    );
    for (const method of methods) {
      const tag = method.mutates ? style.yellow("mutates") : style.dim("reads  ");
      out(`${tag} ${style.bold(method.path)}`);
      if (method.description) out(`        ${style.dim(method.description)}`);
    }
    out(style.dim(`${methods.length} method(s)`));
    return 0;
  }

  const methodPath = args[0];
  if (!methodPath) throw new CliError("A method path is required (see --list)");

  const descriptor = manifest.methods.find((m) => m.path === methodPath);
  if (!descriptor) {
    throw new CliError(
      `Unknown method '${methodPath}'. Run 'csg api --list' to see them.`,
    );
  }

  let callArgs = [];
  if (args[1] !== undefined) {
    let parsed;
    try {
      parsed = JSON.parse(args[1]);
    } catch (error) {
      throw new CliError(`Arguments must be valid JSON: ${error.message}`);
    }
    callArgs = Array.isArray(parsed) ? parsed : [parsed];
  }

  if (flags.file) await loadProject(host, flags.file);

  const result = await host.call(methodPath, callArgs);

  if (flags.write || flags.output) {
    const target = flags.output || flags.file;
    if (!target) throw new CliError("--write needs --file or --output");
    await saveProject(host, target);
  }

  if (result !== undefined) printJson(result);
  return 0;
}
