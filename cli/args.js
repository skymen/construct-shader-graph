// Minimal flag parser. Deliberately dependency-free: the CLI's surface is
// mostly generated from the API manifest, so there is little to parse.

import { CliError } from "./io.js";

/**
 * Parse `argv` into { _: positionals, flags }.
 * Supports --flag, --flag=value, --flag value, -o value, and --no-flag.
 * `booleans` lists flags that never consume the following token.
 */
export function parseArgs(argv, { booleans = [], aliases = {} } = {}) {
  const flags = {};
  const positional = [];
  // Flag names are compared in their camelCase form so `--all-graphs` and the
  // `allGraphs` entry in a command's `booleans` list are the same thing.
  const isBoolean = (name) => booleans.includes(camel(name));

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (token.startsWith("--")) {
      let name = token.slice(2);
      let value;

      const eq = name.indexOf("=");
      if (eq !== -1) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      }

      if (name.startsWith("no-") && value === undefined) {
        flags[camel(name.slice(3))] = false;
        continue;
      }

      name = aliases[name] || name;
      if (value === undefined) {
        if (isBoolean(name)) {
          value = true;
        } else {
          value = argv[i + 1];
          if (value === undefined || value.startsWith("-")) {
            throw new CliError(`Flag --${name} needs a value`);
          }
          i++;
        }
      }
      flags[camel(name)] = value;
      continue;
    }

    if (token.startsWith("-") && token.length > 1 && !isNumeric(token)) {
      const name = aliases[token.slice(1)] || token.slice(1);
      let value;
      if (isBoolean(name)) {
        value = true;
      } else {
        value = argv[i + 1];
        if (value === undefined) throw new CliError(`Flag -${name} needs a value`);
        i++;
      }
      flags[camel(name)] = value;
      continue;
    }

    positional.push(token);
  }

  return { _: positional, flags };
}

function camel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function isNumeric(token) {
  return Number.isFinite(Number(token));
}

export function num(value, flagName) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliError(`--${flagName} must be a number, got '${value}'`);
  }
  return parsed;
}

export function list(value) {
  if (value === undefined) return undefined;
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
