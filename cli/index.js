#!/usr/bin/env node
// Construct Shader Graph CLI.
//
// This file routes; it does not compute. Every command's body reduces to
// `load file -> shaderGraphAPI.call(method, args) -> write file`, so the CLI
// and the app can never disagree about what a shader is or compiles to.

import { parseArgs } from "./args.js";
import { CliError, out, err, style } from "./io.js";

const COMMANDS = {
  create: () => import("./commands/create.js"),
  validate: () => import("./commands/validate.js"),
  lint: () => import("./commands/lint.js"),
  arrange: () => import("./commands/arrange.js"),
  codegen: () => import("./commands/codegen.js"),
  export: () => import("./commands/export.js"),
  comment: () => import("./commands/comment.js"),
  preview: () => import("./commands/preview.js"),
  run: () => import("./commands/run.js"),
  repl: () => import("./commands/repl.js"),
  diff: () => import("./commands/diff.js"),
  paramid: () => import("./commands/paramid.js"),
  api: () => import("./commands/api.js"),
};

// preview needs a real GPU context, so it brings up a headless browser instead
// of the jsdom host. Everything else is pure logic and stays in-process.
const BROWSER_COMMANDS = new Set(["preview"]);

const GLOBAL_BOOLEANS = ["help", "version", "verbose", "force"];

// -f/--force means "write anyway" everywhere. It is global rather than
// per-command because any command that can write can also be blocked by a
// lossy load, and a flag that exists on only some of them is worse than none.
const GLOBAL_ALIASES = { f: "force" };

async function topLevelHelp() {
  out(`${style.bold("csg")} - Construct Shader Graph CLI\n`);
  out("Usage: csg <command> [options]\n");
  out(style.bold("Commands"));
  for (const name of Object.keys(COMMANDS)) {
    const mod = await COMMANDS[name]();
    out(`  ${name.padEnd(10)} ${style.dim(mod.summary || "")}`);
  }
  out(`\nRun ${style.bold("csg <command> --help")} for details.`);
  out(
    style.dim(
      "Every shaderGraphAPI method is also reachable directly: csg api --list",
    ),
  );
}

async function main(argv) {
  const commandName = argv[0];

  if (!commandName || commandName === "--help" || commandName === "-h") {
    await topLevelHelp();
    return 0;
  }

  if (commandName === "--version" || commandName === "-v") {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const root = path.dirname(
      path.dirname(fileURLToPath(import.meta.url)),
    );
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf-8"),
    );
    out(pkg.version);
    return 0;
  }

  const loader = COMMANDS[commandName];
  if (!loader) {
    err(`${style.red("error")}  Unknown command '${commandName}'`);
    err(`Run ${style.bold("csg --help")} to see the available commands.`);
    return 2;
  }

  const mod = await loader();
  const rest = argv.slice(1);

  if (rest.includes("--help") || rest.includes("-h")) {
    out(mod.usage || mod.summary || commandName);
    return 0;
  }

  const { _: args, flags } = parseArgs(rest, {
    booleans: [...(mod.booleans || []), ...GLOBAL_BOOLEANS],
    aliases: { ...GLOBAL_ALIASES, ...(mod.aliases || {}) },
  });

  const host = BROWSER_COMMANDS.has(commandName)
    ? await (await import("./host/browser.js")).createBrowserHost({ flags })
    : await (await import("./host/node.js")).createNodeHost({
        quiet: !flags.verbose,
      });

  try {
    return (await mod.run({ host, args, flags })) ?? 0;
  } finally {
    await host.close();
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    if (error instanceof CliError) {
      err(`${style.red("error")}  ${error.message}`);
    } else {
      err(`${style.red("error")}  ${error?.message || error}`);
      if (process.env.CSG_DEBUG) err(error?.stack || "");
    }
    process.exit(1);
  });
