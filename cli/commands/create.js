import fs from "node:fs";
import { saveProject } from "./_common.js";
import { CliError, out, style } from "../io.js";
import { num } from "../args.js";

export const summary = "Create a new empty project file";
export const usage = `csg create <file.c3sg> [options]

  --name <s>          Shader name
  --author <s>        Author
  --description <s>   Description
  --category <s>      Addon category (default: color)
  --version <v>       X.X.X.X version (default: 0.0.0.0)
  --website <url>
  --documentation <url>

  Flags matching the shader settings checkboxes:
  --blends-background       --cross-sampling
  --no-preserves-opaqueness --animated
  --uses-depth              --must-predraw
  --supports-3d             --deprecated
  --extend-box-h <n>        --extend-box-v <n>

  -f, --force         Overwrite the file if it already exists

The new project contains the default starting nodes, the same thing the
app's New File action produces.`;

export const booleans = [
  "force",
  "blendsBackground",
  "crossSampling",
  "preservesOpaqueness",
  "animated",
  "usesDepth",
  "mustPredraw",
  "supports3d",
  "deprecated",
];
export const aliases = { f: "force", n: "name" };

const STRING_SETTINGS = [
  "name",
  "author",
  "description",
  "category",
  "version",
  "website",
  "documentation",
];

const BOOL_SETTINGS = {
  blendsBackground: "blendsBackground",
  crossSampling: "crossSampling",
  preservesOpaqueness: "preservesOpaqueness",
  animated: "animated",
  usesDepth: "usesDepth",
  mustPredraw: "mustPredraw",
  supports3d: "supports3DDirectRendering",
  deprecated: "isDeprecated",
};

const NUMBER_SETTINGS = { extendBoxH: "extendBoxH", extendBoxV: "extendBoxV" };

export async function run({ host, args, flags }) {
  const file = args[0];
  if (!file) throw new CliError("An output .c3sg path is required");
  if (fs.existsSync(file) && !flags.force) {
    throw new CliError(`${file} already exists - pass --force to overwrite it`);
  }

  const shaderSettings = {};
  for (const key of STRING_SETTINGS) {
    if (flags[key] !== undefined) shaderSettings[key] = String(flags[key]);
  }
  for (const [flag, key] of Object.entries(BOOL_SETTINGS)) {
    if (flags[flag] !== undefined) shaderSettings[key] = !!flags[flag];
  }
  for (const [flag, key] of Object.entries(NUMBER_SETTINGS)) {
    if (flags[flag] !== undefined) shaderSettings[key] = num(flags[flag], flag);
  }

  const result = await host.call("projects.create", [{ shaderSettings }]);
  await saveProject(host, file);

  const nodes = result.graphs[0]?.nodeCount ?? 0;
  out(
    `${style.green("ok")}  created ${file} ${style.dim(
      `(${result.shaderSettings.name || "unnamed"}, ${nodes} default nodes)`,
    )}`,
  );
  return 0;
}
