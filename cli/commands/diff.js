// Compare two projects at the level that matters: what the graph contains and
// what it compiles to. A raw .c3sg text diff is dominated by node coordinates,
// which say nothing about behaviour.

import { readProject, out, style, SHADER_TARGETS } from "../io.js";

export const summary = "Compare two projects by graph structure and output";
export const usage = `csg diff <a.c3sg> <b.c3sg> [options]

  --code-only    Only compare generated shader code
  --ir-only      Only compare graph structure
  --full         Print the full unified diff of changed shaders`;
export const booleans = ["codeOnly", "irOnly", "full"];

async function snapshot(host, file) {
  await host.call("projects.loadSaveData", [readProject(file)]);
  const graphs = await host.call("graphs.list");
  const ir = await host.call("graph.exportIR");
  const uniforms = await host.call("uniforms.list");

  let code = null;
  try {
    code = await host.call("shader.getGeneratedCode");
  } catch {
    code = null; // an invalid project still diffs structurally
  }

  return { graphs, ir, uniforms, code };
}

function diffLines(a, b) {
  // Longest-common-subsequence over lines, emitted as a unified-ish diff. The
  // inputs are single generated shaders, so an O(n*m) table is fine.
  const A = a.split("\n");
  const B = b.split("\n");
  const table = Array.from({ length: A.length + 1 }, () =>
    new Uint32Array(B.length + 1),
  );
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      table[i][j] =
        A[i] === B[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      lines.push(`  ${A[i]}`);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push(style.red(`- ${A[i]}`));
      i++;
    } else {
      lines.push(style.green(`+ ${B[j]}`));
      j++;
    }
  }
  while (i < A.length) lines.push(style.red(`- ${A[i++]}`));
  while (j < B.length) lines.push(style.green(`+ ${B[j++]}`));
  return lines;
}

function countChanges(lines) {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    const bare = line.replace(/\[[0-9;]*m/g, "");
    if (bare.startsWith("+ ")) added++;
    else if (bare.startsWith("- ")) removed++;
  }
  return { added, removed };
}

function compareSets(label, a, b, key) {
  const nameOf = (entry) => String(entry[key]);
  const setA = new Set(a.map(nameOf));
  const setB = new Set(b.map(nameOf));
  const added = [...setB].filter((n) => !setA.has(n));
  const removed = [...setA].filter((n) => !setB.has(n));

  for (const name of removed) out(`${style.red("-")} ${label} ${name}`);
  for (const name of added) out(`${style.green("+")} ${label} ${name}`);
  return added.length + removed.length;
}

export async function run({ host, args, flags }) {
  const [fileA, fileB] = args;
  if (!fileA || !fileB) {
    throw new Error("diff needs two .c3sg files");
  }

  const a = await snapshot(host, fileA);
  const b = await snapshot(host, fileB);

  out(`${style.dim("---")} ${fileA}`);
  out(`${style.dim("+++")} ${fileB}`);
  out();

  let changes = 0;

  if (!flags.codeOnly) {
    out(style.bold("structure"));
    changes += compareSets("graph", a.graphs, b.graphs, "name");
    changes += compareSets("uniform", a.uniforms, b.uniforms, "name");

    const nodesA = a.ir?.nodes?.length ?? 0;
    const nodesB = b.ir?.nodes?.length ?? 0;
    const wiresA = a.ir?.wires?.length ?? 0;
    const wiresB = b.ir?.wires?.length ?? 0;
    if (nodesA !== nodesB || wiresA !== wiresB) {
      out(
        `${style.yellow("~")} main graph ${nodesA} nodes / ${wiresA} wires -> ${nodesB} nodes / ${wiresB} wires`,
      );
      changes++;
    }
    if (changes === 0) out(style.dim("  no structural changes"));
    out();
  }

  if (!flags.irOnly) {
    out(style.bold("generated code"));
    for (const target of SHADER_TARGETS) {
      const codeA = a.code?.[target] ?? "";
      const codeB = b.code?.[target] ?? "";
      if (codeA === codeB) {
        out(`${style.dim("=")} ${target} ${style.dim("identical")}`);
        continue;
      }
      changes++;
      const lines = diffLines(codeA, codeB);
      const { added, removed } = countChanges(lines);
      out(
        `${style.yellow("~")} ${target} ${style.dim(`+${added} -${removed} lines`)}`,
      );
      if (flags.full) {
        for (const line of lines) {
          const bare = line.replace(/\[[0-9;]*m/g, "");
          if (!bare.startsWith("  ")) out(`    ${line}`);
        }
      }
    }
  }

  return changes > 0 ? 1 : 0;
}
