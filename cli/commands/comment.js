import { loadProject, saveProject, resolveOutput } from "./_common.js";
import { CliError, out, style } from "../io.js";
import { list, num } from "../args.js";

export const summary = "Add a comment fitted around a set of nodes";
export const usage = `csg comment <file.c3sg> --nodes <ids> [options]

  --nodes <ids>       Comma-separated node ids to enclose (required)
  --graph <ref>       Graph to add the comment to (default: the active graph)
  --title <text>      Comment title
  --description <t>   Comment body text
  --color <hex>       Comment color, e.g. #4a90e2
  --padding <px>      Gap left around the nodes (default: 30). Only the initial
                      size - 'csg arrange' refits to the default
  --in-place          Write back over the input file
  -o, --output <f>    Write the result to <f>
  -f, --force         Write even if loading dropped unknown node types

Order does not matter: 'csg arrange' refits each comment around the nodes it
enclosed, so commenting first and arranging afterwards is fine. Pass
'--no-fit-comments' to arrange if you want the boxes left exactly where they are.`;
export const booleans = ["inPlace"];
export const aliases = { o: "output", g: "graph", n: "nodes" };

export async function run({ host, args, flags }) {
  const input = await loadProject(host, args[0]);
  const target = resolveOutput(input, flags, { verb: "comment" });

  const nodeIds = list(flags.nodes);
  if (!nodeIds || nodeIds.length === 0) {
    throw new CliError("--nodes requires at least one node id");
  }

  if (flags.graph) await host.call("graphs.setActive", [flags.graph]);

  const comment = await host.call("comments.create", [
    {
      nodeIds: nodeIds.map(Number),
      ...(flags.title !== undefined ? { title: flags.title } : {}),
      ...(flags.description !== undefined
        ? { description: flags.description }
        : {}),
      ...(flags.color !== undefined ? { color: flags.color } : {}),
      ...(flags.padding !== undefined
        ? { padding: num(flags.padding, "padding") }
        : {}),
    },
  ]);

  await saveProject(host, target, flags);

  out(
    `${style.green("ok")}  comment ${comment.id} ${style.dim(
      `at (${Math.round(comment.x)}, ${Math.round(comment.y)}) ${Math.round(comment.width)}x${Math.round(comment.height)}`,
    )}`,
  );
  out(`${style.green("ok")}  wrote ${target}`);
  return 0;
}
