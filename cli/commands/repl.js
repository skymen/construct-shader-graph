// Interactive REPL with the app loaded. Same context `run` gets.

import repl from "node:repl";
import { loadProject, saveProject } from "./_common.js";
import { out, style } from "../io.js";

export const summary = "Open a REPL with a project loaded";
export const usage = `csg repl [file.c3sg]

  -o, --output <f>  Where .save() writes (default: the input file)

In the REPL: sg, api, blueprint, NODE_TYPES, Wire are in scope.
  .save    write the project back out
  .exit    quit`;
export const aliases = { o: "output" };

export async function run({ host, args, flags }) {
  const projectFile = args[0];
  if (projectFile) await loadProject(host, projectFile);

  const target = flags.output || projectFile;

  out(
    style.dim(
      `shader graph repl - sg, api, blueprint, NODE_TYPES, Wire in scope${
        target ? `; .save writes ${target}` : ""
      }`,
    ),
  );

  const server = repl.start({ prompt: "csg> ", useGlobal: false });
  Object.assign(server.context, {
    sg: host.api,
    api: host.api,
    blueprint: host.blueprint,
    NODE_TYPES: host.NODE_TYPES,
    Wire: host.Wire,
  });

  server.defineCommand("save", {
    help: "Write the project back out",
    async action(file) {
      const dest = file || target;
      if (!dest) {
        out(style.red("no output file - pass one: .save out.c3sg"));
      } else {
        await saveProject(host, dest);
        out(`${style.green("ok")}  wrote ${dest}`);
      }
      this.displayPrompt();
    },
  });

  await new Promise((resolve) => server.on("exit", resolve));
  return 0;
}
