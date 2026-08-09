import { loadProject, saveProject, resolveOutput } from "./_common.js";
import { out, style } from "../io.js";

export const summary = "Auto-arrange nodes using the app's layout engine";
export const usage = `csg arrange <file.c3sg> [options]

  --all-graphs      Arrange every graph, not just the main one
  --no-fit-comments Leave comment boxes where they are instead of refitting
                    them around their nodes and pushing them apart
  --in-place        Write back over the input file
  -o, --output <f>  Write the arranged project to <f>
  -f, --force       Write even if loading dropped unknown node types`;
export const booleans = ["allGraphs", "inPlace", "fitComments"];
export const aliases = { o: "output" };

export async function run({ host, args, flags }) {
  const input = await loadProject(host, args[0]);
  const target = resolveOutput(input, flags, { verb: "arrange" });

  const result = await host.call("layout.autoArrange", [
    { allGraphs: !!flags.allGraphs, fitComments: flags.fitComments !== false },
  ]);

  await saveProject(host, target, flags);

  if (flags.allGraphs) {
    for (const graph of result.graphs) {
      out(`${style.dim("arranged")} ${graph.name} ${style.dim(`(${graph.kind})`)}`);
    }
  }
  out(`${style.green("ok")}  wrote ${target}`);
  return 0;
}
