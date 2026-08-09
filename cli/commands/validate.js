import { loadProject } from "./_common.js";
import { out, style, printJson } from "../io.js";

export const summary = "Check a project for errors and lint warnings";
export const usage = `csg validate <file.c3sg> [options]

  --warnings-as-errors   Exit non-zero when there are warnings, not just errors
  --json                 Print the raw validation result`;
export const booleans = ["warningsAsErrors", "json"];

export async function run({ host, args, flags }) {
  await loadProject(host, args[0]);
  const result = await host.call("graph.validate");

  if (flags.json) {
    printJson(result);
  } else {
    for (const error of result.errors) {
      out(`${style.red("error")}  ${error.message}`);
    }
    for (const warning of result.warnings) {
      const where = warning.node ? ` (node ${warning.node.id})` : "";
      out(`${style.yellow("warning")}  ${warning.message}${where}`);
    }

    const graphs = result.graphs.length;
    if (result.errors.length === 0 && result.warnings.length === 0) {
      out(
        `${style.green("ok")}  ${graphs} graph${graphs === 1 ? "" : "s"}, codegen succeeded for ${result.targets.join(", ")}`,
      );
    } else {
      out(
        style.dim(
          `${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
        ),
      );
    }
  }

  if (!result.ok) return 1;
  if (flags.warningsAsErrors && result.warnings.length > 0) return 1;
  return 0;
}
