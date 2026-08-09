// Exercises the CLI's command modules against the real app.
//
// The commands are deliberately thin, so what these assert is mostly that the
// transport is faithful: what goes to disk is what the app produced, and the
// app-side additions the CLI depends on behave.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeCliHost } from "./helpers/cli-host.js";
import { ROOT } from "../headless/boot.js";

const EXAMPLES = path.join(ROOT, "examples");
const SIMPLE = path.join(EXAMPLES, "_shockwave.c3sg");
const MULTIGRAPH = path.join(EXAMPLES, "edge_detect_mask.c3sg");

let host;
let tmp;

beforeAll(async () => {
  // The commands print progress to stdout; these tests assert on the files
  // they produce, so keep the reporter readable.
  process.env.CSG_QUIET = "1";
  host = await makeCliHost();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csg-cli-"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const out = (name) => path.join(tmp, name);

async function runCommand(name, args, flags = {}) {
  const mod = await import(`../cli/commands/${name}.js`);
  return mod.run({ host, args, flags });
}

describe("create", () => {
  it("writes a project that loads, validates and compiles", async () => {
    const file = out("fresh.c3sg");
    expect(await runCommand("create", [file], { name: "Fresh" })).toBe(0);

    await host.call("projects.loadSaveData", [fs.readFileSync(file, "utf-8")]);
    const result = await host.call("graph.validate");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.graphs).toHaveLength(1);
  });

  it("starts from a blank slate", async () => {
    const file = out("blank.c3sg");
    await runCommand("create", [file], {});
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));

    expect(data.uniforms).toEqual([]);
    expect(data.deprecatedUniforms).toEqual([]);
    expect(data.customNodes).toEqual([]);
    expect(data.comments).toEqual([]);
    expect(data._additionalGraphs).toBeUndefined();
    // The Output node cannot be deleted, so "empty" means the default nodes.
    expect(data.nodes.map((n) => n.nodeTypeKey)).toContain("output");
  });

  it("applies shader settings, including the newer keys", async () => {
    const file = out("named.c3sg");
    await runCommand("create", [file], {
      name: "Named",
      author: "Someone",
      animated: true,
      usesDepth: true,
      extendBoxH: 12,
    });

    const settings = JSON.parse(fs.readFileSync(file, "utf-8")).shaderSettings;
    expect(settings.name).toBe("Named");
    expect(settings.author).toBe("Someone");
    expect(settings.animated).toBe(true);
    expect(settings.usesDepth).toBe(true);
    expect(settings.extendBoxH).toBe(12);
    // Regression: createNewFile used to write a settings literal that was
    // missing these, so a new project could not round-trip them.
    expect(settings).toHaveProperty("mustPredraw");
    expect(settings).toHaveProperty("supports3DDirectRendering");
  });

  it("refuses to clobber an existing file without --force", async () => {
    const file = out("guard.c3sg");
    await runCommand("create", [file], {});
    await expect(runCommand("create", [file], {})).rejects.toThrow(
      /already exists/,
    );
    expect(await runCommand("create", [file], { force: true })).toBe(0);
  });

  it("is a usable starting point for further commands", async () => {
    const file = out("chain.c3sg");
    await runCommand("create", [file], { name: "Chain" });

    await host.call("projects.loadSaveData", [fs.readFileSync(file, "utf-8")]);
    await host.call("uniforms.create", [
      { name: "strength", type: "float", value: 0.5 },
    ]);
    const shaders = await host.call("shader.getGeneratedCode");
    expect(shaders.webgl1).toContain("uniform_strength");
  });
});

describe("validate", () => {
  it("reports a clean project and exits 0", async () => {
    const code = await runCommand("validate", [SIMPLE], { json: true });
    expect(code).toBe(0);

    const result = await host.call("graph.validate");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.targets).toEqual(["webgl1", "webgl2", "webgpu"]);
  });

  it("exits 1 when --warnings-as-errors and warnings exist", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const warnings = await host.call("ai.getWarnings");
    const code = await runCommand("validate", [SIMPLE], {
      warningsAsErrors: true,
      json: true,
    });
    expect(code).toBe(warnings.length > 0 ? 1 : 0);
  });
});

describe("arrange", () => {
  it("only moves nodes: generated code is byte-identical afterwards", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const before = await host.call("shader.getGeneratedCode");

    const target = out("arranged.c3sg");
    await runCommand("arrange", [MULTIGRAPH], {
      allGraphs: true,
      output: target,
    });

    await host.call("projects.loadSaveData", [
      fs.readFileSync(target, "utf-8"),
    ]);
    expect(await host.call("shader.getGeneratedCode")).toEqual(before);
  });

  it("is idempotent - arranging twice lands in the same place", async () => {
    const once = out("once.c3sg");
    const twice = out("twice.c3sg");
    await runCommand("arrange", [MULTIGRAPH], { allGraphs: true, output: once });
    await runCommand("arrange", [once], { allGraphs: true, output: twice });

    const positions = (file) =>
      JSON.parse(fs.readFileSync(file, "utf-8")).nodes.map((n) => [n.x, n.y]);
    expect(positions(twice)).toEqual(positions(once));
  });

  it("refuses to run without somewhere to write", async () => {
    await expect(runCommand("arrange", [MULTIGRAPH], {})).rejects.toThrow(
      /--in-place|-o/,
    );
  });

  // The gallery thumbnail is captured off the live preview iframe, so
  // getSaveData never produces one headlessly. Any write command would strip it
  // from the user's file unless it is carried across from the input.
  it("keeps the preview thumbnail the input file had", async () => {
    const withShot = out("with-thumbnail.c3sg");
    const project = JSON.parse(fs.readFileSync(MULTIGRAPH, "utf-8"));
    project.previewScreenshot = "data:image/png;base64,SGVsbG8=";
    fs.writeFileSync(withShot, JSON.stringify(project));

    const target = out("arranged-thumbnail.c3sg");
    await runCommand("arrange", [withShot], { allGraphs: true, output: target });

    const written = JSON.parse(fs.readFileSync(target, "utf-8"));
    expect(written.previewScreenshot).toBe(project.previewScreenshot);
  });

  // Comments used to be left behind wherever the nodes had been, which is why
  // `csg comment` still tells you to arrange first. Both directions now work.
  it("carries comment boxes along with the nodes they enclosed", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const ids = host.blueprint.nodes.slice(0, 3).map((n) => n.id);
    const commented = out("commented-then-arranged.c3sg");
    await runCommand("comment", [MULTIGRAPH], {
      nodes: ids.join(","),
      title: "Group",
      output: commented,
    });

    const arranged = out("arranged-with-comment.c3sg");
    await runCommand("arrange", [commented], {
      allGraphs: true,
      output: arranged,
    });

    await host.call("projects.loadSaveData", [
      fs.readFileSync(arranged, "utf-8"),
    ]);
    const comment = host.blueprint.comments.find((c) => c.title === "Group");
    for (const node of host.blueprint.nodes) {
      expect(comment.containsNode(node)).toBe(ids.includes(node.id));
    }
  });

  it("--no-fit-comments leaves the boxes exactly where they were", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const ids = host.blueprint.nodes.slice(0, 3).map((n) => n.id);
    const commented = out("commented-frozen.c3sg");
    await runCommand("comment", [MULTIGRAPH], {
      nodes: ids.join(","),
      output: commented,
    });
    const before = JSON.parse(fs.readFileSync(commented, "utf-8")).comments;

    const arranged = out("arranged-frozen.c3sg");
    await runCommand("arrange", [commented], {
      allGraphs: true,
      fitComments: false,
      output: arranged,
    });

    const after = JSON.parse(fs.readFileSync(arranged, "utf-8")).comments;
    expect(after).toEqual(before);
  });
});

describe("codegen", () => {
  it("writes the three target files with the app's own contents", async () => {
    const dir = out("gen");
    await runCommand("codegen", [SIMPLE], { output: dir });

    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const shaders = host.blueprint.generateAllShaders();

    expect(fs.readFileSync(path.join(dir, "effect.fx"), "utf-8")).toBe(
      shaders.webgl1,
    );
    expect(fs.readFileSync(path.join(dir, "effect.webgl2.fx"), "utf-8")).toBe(
      shaders.webgl2,
    );
    expect(fs.readFileSync(path.join(dir, "effect.wgsl"), "utf-8")).toBe(
      shaders.webgpu,
    );
  });

  it("--target selects a single language", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const one = await host.call("shader.getGeneratedCode", [
      { target: "webgl1" },
    ]);
    expect(Object.keys(one)).toEqual(["webgl1"]);
  });

  it("a function graph emits its own declarations, not the whole shader", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const fn = await host.call("shader.getGeneratedCode", [
      { graph: "FrontAtOffset", target: "webgl2" },
    ]);

    expect(fn.webgl2).toContain("FrontAtOffset");
    expect(fn.webgl2).toMatch(/vec4 fn_g_\d+\(/);
    // The whole-shader entry point belongs to the main graph only.
    expect(fn.webgl2).not.toContain("void main");
  });

  it("rejects an unknown target", async () => {
    await expect(
      runCommand("codegen", [SIMPLE], { target: "vulkan" }),
    ).rejects.toThrow(/--target/);
  });
});

describe("export", () => {
  it("produces the five addon files and a loadable zip", async () => {
    const dir = out("addon");
    await runCommand("export", [SIMPLE], { output: dir });

    const files = fs.readdirSync(dir);
    const archive = files.find((f) => f.endsWith(".c3addon"));
    expect(archive).toBeTruthy();

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, archive)));
    expect(Object.keys(zip.files).sort()).toEqual([
      "addon.json",
      "effect.fx",
      "effect.webgl2.fx",
      "effect.wgsl",
      "lang/",
      "lang/en-US.json",
    ]);
  });

  it("--unpacked writes the same contents loose", async () => {
    const dir = out("unpacked");
    await runCommand("export", [SIMPLE], { output: dir, unpacked: true });

    const root = path.join(dir, fs.readdirSync(dir)[0]);
    expect(fs.existsSync(path.join(root, "addon.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "lang", "en-US.json"))).toBe(true);
  });

  it("--bump raises the version without touching paramIds", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const before = await host.call("projects.getAddonJson");

    const bundle = await host.call("projects.buildAddonBundle", [
      { bumpVersion: "minor" },
    ]);
    const after = JSON.parse(bundle.files["addon.json"]);

    expect(after.version).not.toBe(before.version);
    expect(after.parameters.map((p) => p.id)).toEqual(
      before.parameters.map((p) => p.id),
    );
  });

  it("matches what the app's own export path builds", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const bundle = host.blueprint.buildAddonBundle();
    const shaders = host.blueprint.generateAllShaders();

    expect(bundle.files["effect.fx"]).toBe(shaders.webgl1);
    expect(bundle.files["effect.webgl2.fx"]).toBe(shaders.webgl2);
    expect(bundle.files["effect.wgsl"]).toBe(shaders.webgpu);
    expect(JSON.parse(bundle.files["addon.json"])).toEqual(
      host.blueprint.generateAddonJson(),
    );
  });
});

describe("comment", () => {
  it("fits a comment that encloses exactly the requested nodes", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const ids = host.blueprint.nodes.slice(0, 3).map((n) => n.id);

    const target = out("commented.c3sg");
    await runCommand("comment", [MULTIGRAPH], {
      nodes: ids.join(","),
      title: "Group",
      description: "some nodes",
      output: target,
    });

    await host.call("projects.loadSaveData", [
      fs.readFileSync(target, "utf-8"),
    ]);
    const comment = host.blueprint.comments.at(-1);
    expect(comment.title).toBe("Group");
    expect(comment.description).toBe("some nodes");

    // containsNode is the app's own hit test, so this asserts the comment
    // behaves as a group in the editor, not merely that the numbers look right.
    for (const node of host.blueprint.nodes) {
      expect(comment.containsNode(node)).toBe(ids.includes(node.id));
    }
  });

  it("leaves the default padding around the nodes and room for the title", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const nodes = host.blueprint.nodes.slice(0, 4);
    const comment = await host.call("comments.create", [
      { nodeIds: nodes.map((n) => n.id), padding: 10 },
    ]);

    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));

    expect(comment.x).toBe(minX - 10);
    expect(comment.x + comment.width).toBe(maxX + 10);
    expect(comment.y + comment.height).toBe(maxY + 10);
    // The title bar sits inside the rect, so the top gap exceeds the padding.
    expect(minY - comment.y).toBeGreaterThan(10);
  });

  it("requires at least one node", async () => {
    await expect(
      runCommand("comment", [MULTIGRAPH], { nodes: "", output: out("x.c3sg") }),
    ).rejects.toThrow(/--nodes/);
  });
});

describe("paramid", () => {
  it("passes against an unchanged baseline", async () => {
    const copy = out("baseline.c3sg");
    fs.copyFileSync(SIMPLE, copy);
    const code = await runCommand("paramid", [SIMPLE], { baseline: copy });
    expect(code).toBe(0);
  });

  it("catches a parameter that was removed for good", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const uniform = (await host.call("uniforms.list"))[0];
    await host.call("uniforms.delete", [uniform.id]);
    // An ordinary delete keeps the parameter as deprecated, which is exactly
    // what protects existing projects. Only deleteForever really removes it.
    await host.call("uniforms.deleteForever", [uniform.id]);

    const broken = out("broken.c3sg");
    fs.writeFileSync(
      broken,
      JSON.stringify(await host.call("projects.getSaveData"), null, 2),
    );

    const code = await runCommand("paramid", [broken], { baseline: SIMPLE });
    expect(code).toBe(1);
  });

  it("treats a deprecated parameter as still present", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const uniform = (await host.call("uniforms.list"))[0];
    await host.call("uniforms.delete", [uniform.id]);

    const deprecated = out("deprecated.c3sg");
    fs.writeFileSync(
      deprecated,
      JSON.stringify(await host.call("projects.getSaveData"), null, 2),
    );

    const code = await runCommand("paramid", [deprecated], { baseline: SIMPLE });
    expect(code).toBe(0);
  });
});

describe("diff", () => {
  it("reports no change between a file and its copy", async () => {
    const copy = out("copy.c3sg");
    fs.copyFileSync(SIMPLE, copy);
    expect(await runCommand("diff", [SIMPLE, copy], {})).toBe(0);
  });

  it("reports a change when the generated code differs", async () => {
    expect(await runCommand("diff", [SIMPLE, MULTIGRAPH], {})).toBe(1);
  });
});

describe("api", () => {
  it("exposes every manifest method with no hand-written table", async () => {
    const manifest = host.manifest();
    const paths = manifest.methods.map((m) => m.path);

    // The additions the CLI depends on are reachable the same way as the rest.
    for (const method of [
      "graph.validate",
      "graphs.list",
      "graphs.setActive",
      "comments.create",
      "projects.create",
      "projects.buildAddonBundle",
      "projects.getSaveData",
      "projects.loadSaveData",
      "projects.getAddonJson",
    ]) {
      expect(paths, `missing descriptor for ${method}`).toContain(method);
    }

    // Every descriptor must actually resolve to a callable, or `csg api` would
    // advertise something that cannot be invoked.
    for (const method of manifest.methods) {
      const fn = method.path
        .split(".")
        .reduce((node, key) => node?.[key], host.api);
      expect(typeof fn, `${method.path} is not callable`).toBe("function");
    }
  });

  it("rejects an unknown method", async () => {
    await expect(runCommand("api", ["nope.nope"], {})).rejects.toThrow(
      /Unknown method/,
    );
  });
});

describe("run", () => {
  it("evaluates an expression against the live api", async () => {
    const mod = await import("../cli/commands/run.js");
    const code = await mod.run({
      host,
      args: [SIMPLE],
      flags: { eval: "sg.graphs.list().length" },
    });
    expect(code).toBe(0);
  });

  it("can mutate and write the project back", async () => {
    const target = out("mutated.c3sg");
    const mod = await import("../cli/commands/run.js");
    await mod.run({
      host,
      args: [SIMPLE],
      flags: {
        eval: `sg.shader.updateInfo({ name: "Renamed" })`,
        output: target,
      },
    });

    const saved = JSON.parse(fs.readFileSync(target, "utf-8"));
    expect(saved.shaderSettings.name).toBe("Renamed");
  });
});

describe("graphs and layout additions", () => {
  it("resolves graphs by id, name, and the main/active aliases", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const graphs = await host.call("graphs.list");
    const fn = graphs.find((g) => g.kind === "function");

    expect((await host.call("graphs.get", ["main"])).isMain).toBe(true);
    expect((await host.call("graphs.get", [fn.id])).name).toBe(fn.name);
    expect((await host.call("graphs.get", [fn.name])).id).toBe(fn.id);

    await host.call("graphs.setActive", [fn.id]);
    expect((await host.call("graphs.getActive")).id).toBe(fn.id);
    await host.call("graphs.setActive", ["main"]);
  });

  it("autoArrange allGraphs touches every graph that has nodes", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    const result = await host.call("layout.autoArrange", [{ allGraphs: true }]);
    const withNodes = (await host.call("graphs.list")).filter(
      (g) => g.nodeCount > 0,
    );
    expect(result.graphs.map((g) => g.id).sort()).toEqual(
      withNodes.map((g) => g.id).sort(),
    );
  });

  it("rejects combining allGraphs with nodeIds", async () => {
    await expect(
      host.call("layout.autoArrange", [{ allGraphs: true, nodeIds: [1] }]),
    ).rejects.toThrow(/cannot combine/);
  });
});

describe("lint / graph.audit", () => {
  it("reports a clean example as ok", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const audit = await host.call("graph.audit");
    expect(audit.stats.nodes).toBeGreaterThan(0);
    expect(audit.issues.filter((i) => i.kind === "deadNode")).toEqual([]);
  });

  it("catches a node that reaches neither the Output nor a Set Variable", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const before = (await host.call("graph.audit")).stats.deadNodes;
    await host.call("nodes.create", [{ type: "frontUV" }]);

    const audit = await host.call("graph.audit");
    expect(audit.stats.deadNodes).toBe(before + 1);
    expect(audit.ok).toBe(false);
  });

  it("catches a variable still carrying the auto-generated name", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    // Let the app name it: that is exactly the case worth flagging.
    const fanout = host.blueprint.nodes.find((nd) =>
      nd.outputPorts.some(
        (p) =>
          new Set(p.connections.map((wp) => wp.endPort.node.id)).size > 1,
      ),
    );
    if (!fanout) return;
    const port = fanout.outputPorts.find(
      (p) => new Set(p.connections.map((wp) => wp.endPort.node.id)).size > 1,
    );
    await host.call("graph.rewriteFanoutAsVariable", [
      { nodeId: fanout.id, outputName: port.name, autoLayout: false },
    ]);

    const audit = await host.call("graph.audit");
    expect(
      audit.issues.some((i) => i.kind === "autoNamedVariable"),
      "an unnamed rewrite should be reported",
    ).toBe(true);
  });

  it("accepts a variable that was given a real name", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const fanout = host.blueprint.nodes.find((nd) =>
      nd.outputPorts.some(
        (p) =>
          new Set(p.connections.map((wp) => wp.endPort.node.id)).size > 1,
      ),
    );
    if (!fanout) return;
    const port = fanout.outputPorts.find(
      (p) => new Set(p.connections.map((wp) => wp.endPort.node.id)).size > 1,
    );
    await host.call("graph.rewriteFanoutAsVariable", [
      {
        nodeId: fanout.id,
        outputName: port.name,
        variableName: "wave_centre",
        autoLayout: false,
      },
    ]);

    const audit = await host.call("graph.audit");
    expect(audit.issues.filter((i) => i.kind === "autoNamedVariable")).toEqual(
      [],
    );
  });

  it("reports nodes that sit in no comment, and stops once they do", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    // No comments at all means the check is inert - it only grades a graph
    // that claims to be documented.
    expect((await host.call("graph.audit")).stats.uncommentedNodes).toBe(0);

    await host.call("comments.create", [
      { nodeIds: [host.blueprint.nodes[0].id], title: "One node" },
    ]);
    expect(
      (await host.call("graph.audit")).stats.uncommentedNodes,
    ).toBeGreaterThan(0);

    await host.call("comments.create", [
      { nodeIds: host.blueprint.nodes.map((nd) => nd.id), title: "All" },
    ]);
    expect((await host.call("graph.audit")).stats.uncommentedNodes).toBe(0);
  });

  it("flags an output wired straight into many consumers", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const audit = await host.call("graph.audit", [{ maxFanout: 0 }]);
    expect(audit.issues.some((i) => i.kind === "unroutedFanout")).toBe(true);
  });
});

describe("wire routing", () => {
  it("reroutes wires off nodes they do not connect to", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    await host.call("layout.autoArrange", [{ allGraphs: true }]);

    const before = (await host.call("graph.audit")).stats;
    await host.call("layout.routeWires", [{ allGraphs: true }]);
    const after = (await host.call("graph.audit")).stats;

    expect(after.wireOverNode).toBeLessThanOrEqual(before.wireOverNode);
    expect(after.backwardEntries).toBeLessThanOrEqual(before.backwardEntries);
  });

  it("routing adds reroute points but never changes the generated code", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(MULTIGRAPH, "utf-8"),
    ]);
    await host.call("layout.autoArrange", [{ allGraphs: true }]);
    const before = await host.call("shader.getGeneratedCode");

    await host.call("layout.routeWires", [{ allGraphs: true }]);
    expect(await host.call("shader.getGeneratedCode")).toEqual(before);
  });

  it("parks each Set Variable beside the node it stores", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const fanout = host.blueprint.nodes.find((nd) =>
      nd.outputPorts.some(
        (p) => new Set(p.connections.map((w) => w.endPort.node.id)).size > 1,
      ),
    );
    if (!fanout) return;
    const port = fanout.outputPorts.find(
      (p) => new Set(p.connections.map((w) => w.endPort.node.id)).size > 1,
    );
    await host.call("graph.rewriteFanoutAsVariable", [
      {
        nodeId: fanout.id,
        outputName: port.name,
        variableName: "stored_value",
        autoLayout: false,
      },
    ]);
    await host.call("layout.autoArrange", [{}]);
    await host.call("layout.tidyVariables", [{}]);

    const setNode = host.blueprint.nodes.find(
      (nd) =>
        host.blueprint.getNodeTypeKey(nd.nodeType) === "setVariable" &&
        nd.customInput === "stored_value",
    );
    const source = setNode.inputPorts[0].connections[0].startPort.node;
    expect(setNode.x).toBeGreaterThan(source.x);
    expect(setNode.x - (source.x + source.width)).toBeLessThan(200);
  });

  it("routes a single-consumer value when asked", async () => {
    await host.call("projects.loadSaveData", [
      fs.readFileSync(SIMPLE, "utf-8"),
    ]);
    const single = host.blueprint.nodes.find((nd) =>
      nd.outputPorts.some((p) => p.connections.length === 1),
    );
    const port = single.outputPorts.find((p) => p.connections.length === 1);

    await expect(
      host.call("graph.rewriteFanoutAsVariable", [
        { nodeId: single.id, outputName: port.name, autoLayout: false },
      ]),
    ).rejects.toThrow(/does not fan out/);

    await host.call("graph.rewriteFanoutAsVariable", [
      {
        nodeId: single.id,
        outputName: port.name,
        variableName: "one_reader",
        allowSingle: true,
        autoLayout: false,
      },
    ]);
    expect(
      host.blueprint.nodes.some(
        (nd) =>
          host.blueprint.getNodeTypeKey(nd.nodeType) === "setVariable" &&
          nd.customInput === "one_reader",
      ),
    ).toBe(true);
  });
});
