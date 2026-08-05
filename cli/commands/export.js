import path from "node:path";
import { loadProject } from "./_common.js";
import { CliError, out, style, writeFile, ensureDir } from "../io.js";

const BUMPS = ["major", "minor", "patch", "revision"];

export const summary = "Build the .c3addon package";
export const usage = `csg export <file.c3sg> [options]

  -o, --output <d>  Output directory (default: current directory)
  --bump <part>     Bump the version first: ${BUMPS.join(" | ")}
  --version <v>     Set an explicit X.X.X.X version first
  --unpacked        Write the loose files instead of a zipped .c3addon`;
export const booleans = ["unpacked"];
export const aliases = { o: "output" };

export async function run({ host, args, flags }) {
  await loadProject(host, args[0]);

  if (flags.bump && !BUMPS.includes(flags.bump)) {
    throw new CliError(`--bump must be one of ${BUMPS.join(", ")}`);
  }
  if (flags.bump && flags.version) {
    throw new CliError("Pass either --bump or --version, not both");
  }

  const bundle = await host.call("projects.buildAddonBundle", [
    {
      ...(flags.bump ? { bumpVersion: flags.bump } : {}),
      ...(flags.version ? { version: flags.version } : {}),
    },
  ]);

  const dir = flags.output || ".";

  if (flags.unpacked) {
    const root = path.join(dir, bundle.filename.replace(/\.c3addon$/, ""));
    for (const [name, content] of Object.entries(bundle.files)) {
      writeFile(path.join(root, name), content);
    }
    out(`${style.green("ok")}  wrote ${Object.keys(bundle.files).length} files to ${root}`);
    return 0;
  }

  // Zipping runs inside the app so the CLI uses the same JSZip the download
  // button does; only the output type differs.
  const zip = await host.zipBundle(bundle, "uint8array");
  const file = path.join(dir, bundle.filename);
  ensureDir(dir);
  writeFile(file, Buffer.from(zip));
  out(`${style.green("ok")}  wrote ${file} ${style.dim(`(v${bundle.version})`)}`);
  return 0;
}
