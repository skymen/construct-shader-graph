// Readability audit. `validate` asks whether the shader compiles; this asks
// whether a human can read the graph afterwards. Codegen is perfectly happy
// with dead nodes, unnamed variables and wires crossing the whole canvas, so
// none of that shows up there.

import { loadProject } from "./_common.js";
import { out, style, printJson } from "../io.js";

export const summary = "Audit graph readability (dead nodes, naming, layout)";
export const usage = `csg lint <file.c3sg> [options]

  --max-fanout <n>   Direct consumers allowed before a named variable is
                     expected (default: 2)
  --max-crossings <n>  Fail if wires cross more than this many times
  --json             Print the raw audit result

Checks:
  deadNode             reaches neither the Output nor a Set Variable
  uncommentedNode      sits inside no comment
  multiCommentedNode   sits inside several comments at once
  overlappingComments  two comments overlap by more than 25%
  nonConvexComment     an unrelated node sits on a path between two of the
                       comment's own nodes, so the box cannot stay tight
  commentSwallowsNode  a node inside a comment is wired to nothing else in it
  autoNamedVariable    still carries the name auto-arrange generated
  unroutedFanout       one output wired straight into many consumers
  wireOverNode         a wire is drawn over a node it does not connect to
  backwardEntry        a wire arrives at a port from the right
  longWire             a wire hauls across the canvas instead of connecting locally

Exits non-zero if anything is reported.`;
export const booleans = ["json"];

const ORDER = [
  "deadNode",
  "autoNamedVariable",
  "unroutedFanout",
  "wireOverNode",
  "longWire",
  "backwardEntry",
  "uncommentedNode",
  "multiCommentedNode",
  "nonConvexComment",
  "commentSwallowsNode",
  "overlappingComments",
];

export async function run({ host, args, flags }) {
  await loadProject(host, args[0]);

  const result = await host.call("graph.audit", [
    ...(flags.maxFanout !== undefined
      ? [{ maxFanout: Number(flags.maxFanout) }]
      : []),
  ]);

  if (flags.json) {
    printJson(result);
  } else {
    const { stats } = result;
    out(
      style.dim(
        `${stats.nodes} nodes, ${stats.wires} wires, ${stats.comments} comments, ` +
          `${stats.wireOverNode} over nodes, ${stats.longWires} long, ${stats.backwardEntries} backward, ${stats.crossings} crossings`,
      ),
    );

    const byKind = new Map();
    for (const issue of result.issues) {
      if (!byKind.has(issue.kind)) byKind.set(issue.kind, []);
      byKind.get(issue.kind).push(issue);
    }

    for (const kind of ORDER) {
      const group = byKind.get(kind);
      if (!group) continue;
      out(`${style.yellow(kind)} ${style.dim(`(${group.length})`)}`);
      // Long lists of the same problem are noise; the count carries it.
      for (const issue of group.slice(0, 8)) {
        out(`  ${issue.message}`);
      }
      if (group.length > 8) {
        out(style.dim(`  ...and ${group.length - 8} more`));
      }
    }

    for (const [kind, group] of byKind) {
      if (ORDER.includes(kind)) continue;
      out(`${style.yellow(kind)} ${style.dim(`(${group.length})`)}`);
      for (const issue of group.slice(0, 8)) out(`  ${issue.message}`);
    }

    if (result.ok) out(`${style.green("ok")}  nothing to report`);
  }

  if (!result.ok) return 1;
  if (
    flags.maxCrossings !== undefined &&
    result.stats.crossings > Number(flags.maxCrossings)
  ) {
    out(
      `${style.red("fail")}  ${result.stats.crossings} wire crossings exceeds --max-crossings ${flags.maxCrossings}`,
    );
    return 1;
  }
  return 0;
}
