import path from "node:path";
import { loadProject } from "./_common.js";
import {
  CliError,
  out,
  style,
  writeFile,
  shaderFilename,
  SHADER_TARGETS,
} from "../io.js";

export const summary = "Generate shader code";
export const usage = `csg codegen <file.c3sg> [options]

  --graph <ref>     Graph id, name, 'main' or 'active'. A function or loop-body
                    graph emits its own declarations, the same thing View Code
                    shows for that subgraph. Defaults to the main graph.
  --target <t>      ${SHADER_TARGETS.join(" | ")} | all   (default: all)
  -o, --output <d>  Write into directory <d> instead of stdout`;
export const aliases = { o: "output", t: "target", g: "graph" };

export async function run({ host, args, flags }) {
  await loadProject(host, args[0]);

  const target = flags.target || "all";
  if (target !== "all" && !SHADER_TARGETS.includes(target)) {
    throw new CliError(
      `--target must be one of ${SHADER_TARGETS.join(", ")} or all`,
    );
  }

  const shaders = await host.call("shader.getGeneratedCode", [
    { graph: flags.graph, target },
  ]);

  const entries = Object.entries(shaders);

  if (!flags.output) {
    for (const [name, code] of entries) {
      if (entries.length > 1) out(style.dim(`// ---- ${name} ----`));
      out(code);
    }
    return 0;
  }

  for (const [name, code] of entries) {
    const file = path.join(flags.output, shaderFilename(name));
    writeFile(file, code);
    out(`${style.green("ok")}  wrote ${file}`);
  }
  return 0;
}
