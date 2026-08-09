// Uniform paramIds are the addon's stable parameter identity: Construct
// matches a saved .c3p's parameter values to the addon by id, not by name.
// Changing, dropping or retyping an id silently breaks every project already
// using the addon, so this is worth checking before publishing an upgrade.
//
// Both sides are compared as addon parameter lists rather than as graph
// uniforms, because that is the form the id actually ships in - and because
// a graph uniform's type ("float") and its addon type ("percent") are
// different vocabularies for the same thing.

import fs from "node:fs";
import { loadProject } from "./_common.js";
import { CliError, readProject, out, style, printJson } from "../io.js";

export const summary = "Check uniform paramIds against a published baseline";
export const usage = `csg paramid <file.c3sg> [options]

  -b, --baseline <f>   Compare against an older .c3sg or .c3addon
  --json               Print the id tables as JSON

Without --baseline this just lists the current parameters.`;
export const booleans = ["json"];
export const aliases = { b: "baseline" };

function normalize(parameters) {
  return (parameters || []).map((param) => ({
    id: param.id,
    name: param.name ?? param.id,
    type: param.type,
  }));
}

async function addonParams(host, file) {
  if (file.endsWith(".c3addon")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const entry = zip.file("addon.json");
    if (!entry) throw new CliError(`${file} has no addon.json`);
    return normalize(JSON.parse(await entry.async("string")).parameters);
  }

  await host.call("projects.loadSaveData", [readProject(file)]);
  const addon = await host.call("projects.getAddonJson");
  return normalize(addon.parameters);
}

export async function run({ host, args, flags }) {
  // The baseline is read first because reading a .c3sg baseline loads it into
  // the same host; the real project is loaded afterwards and wins.
  const before = flags.baseline ? await addonParams(host, flags.baseline) : null;

  await loadProject(host, args[0]);
  const current = normalize(
    (await host.call("projects.getAddonJson")).parameters,
  );

  if (flags.json) printJson({ baseline: before, current });

  if (!before) {
    if (!flags.json) {
      for (const param of current) {
        out(
          `${style.dim(param.id)}  ${param.name} ${style.dim(`(${param.type})`)}`,
        );
      }
      out(style.dim(`${current.length} parameter(s)`));
    }
    return 0;
  }

  const byId = new Map(current.map((param) => [param.id, param]));
  const problems = [];

  for (const param of before) {
    const now = byId.get(param.id);
    if (!now) {
      problems.push(
        `parameter '${param.name}' (id ${param.id}) is gone - existing projects lose its value`,
      );
    } else if (now.type !== param.type) {
      problems.push(
        `parameter '${now.name}' (id ${param.id}) changed type ${param.type} -> ${now.type}`,
      );
    }
  }

  const seen = new Set();
  for (const param of current) {
    if (seen.has(param.id)) {
      problems.push(`duplicate paramId ${param.id} on '${param.name}'`);
    }
    seen.add(param.id);
  }

  if (!flags.json) {
    for (const param of current) {
      if (!before.some((entry) => entry.id === param.id)) {
        out(`${style.green("+")} new parameter '${param.name}' (${param.id})`);
      }
    }
    for (const problem of problems) {
      out(`${style.red("break")}  ${problem}`);
    }
    if (problems.length === 0) {
      out(
        `${style.green("ok")}  all ${before.length} baseline paramId(s) preserved`,
      );
    }
  }

  return problems.length > 0 ? 1 : 0;
}
