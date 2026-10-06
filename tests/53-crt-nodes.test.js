// CRT nodes: Barrel Distort, Scanlines, Phosphor Mask.
//
// Each node is one helper function per target. These pin the port order (a
// reorder silently rewires saved files, since port values load by index), that
// every target declares the helpers and calls them from main, that the Phosphor
// Mask dropdown picks the matching layout in every language, and that the
// nodes are named in every UI language. Whether the code compiles is checked
// with `csg preview`: jsdom has no GPU.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import languages from "../lang/index.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

const TARGETS = ["webgl1", "webgl2", "webgpu"];
const MASK_FUNCTIONS = {
  aperture: "crtApertureGrille",
  slot: "crtSlotMask",
  shadow: "crtShadowMask",
};

// Front UV -> Barrel Distort -> Back Texture -> Scanlines -> Phosphor Mask -> Output
function buildChain(maskOperation) {
  for (const node of api.nodes.list()) {
    if (node.typeKey !== "output") api.nodes.delete(node.id);
  }
  const { imported } = api.graph.importIR({
    version: 1,
    autoLayout: false,
    nodes: [
      { id: "uv", type: "frontUV" },
      { id: "barrel", type: "barrelDistort" },
      { id: "back", type: "textureBack", operation: "raw" },
      { id: "scan", type: "scanlines" },
      { id: "mask", type: "phosphorMask", operation: maskOperation },
      { id: "rgba", type: "appendVec4" },
    ],
    wires: [
      { from: "uv.UV", to: "barrel.UV" },
      { from: "barrel.UV", to: "back.UV" },
      { from: "back.Color", to: "scan.Color" },
      { from: "barrel.UV", to: "scan.UV" },
      { from: "scan.Color", to: "mask.Color" },
      { from: "barrel.UV", to: "mask.UV" },
      { from: "mask.Color", to: "rgba.A" },
      { from: "barrel.Mask", to: "rgba.B" },
    ],
  });
  const output = api.nodes.list().find((n) => n.typeKey === "output");
  api.wires.create({
    from: { nodeId: imported.localToNodeId.rgba, kind: "output", name: "Result" },
    to: { nodeId: output.id, kind: "input", name: "Color" },
  });
  return blueprint.generateAllShaders();
}

function split(src, target) {
  const at = src.indexOf(target === "webgpu" ? "@fragment" : "void main");
  expect(at).toBeGreaterThan(-1);
  return { declarations: src.slice(0, at), main: src.slice(at) };
}

const portNames = (ports) => ports.map((p) => p.name);

describe("CRT nodes", () => {
  it("keep their port order", () => {
    expect(portNames(NODE_TYPES.barrelDistort.inputs)).toEqual([
      "UV", "Curvature", "Fill", "Aspect", "Corner Radius", "Softness",
    ]);
    expect(portNames(NODE_TYPES.barrelDistort.outputs)).toEqual(["UV", "Mask", "Distance"]);
    expect(portNames(NODE_TYPES.scanlines.inputs)).toEqual(["Color", "UV", "Lines", "Intensity"]);
    expect(portNames(NODE_TYPES.scanlines.outputs)).toEqual(["Color", "Beam"]);
    expect(portNames(NODE_TYPES.phosphorMask.inputs)).toEqual(["Color", "UV", "Cells", "Intensity"]);
    expect(portNames(NODE_TYPES.phosphorMask.outputs)).toEqual(["Color", "Mask"]);
  });

  it.each(TARGETS)("%s declares every helper before main and calls it there", (target) => {
    const { declarations, main } = split(buildChain("aperture")[target], target);
    const keyword = target === "webgpu" ? "fn " : "";
    for (const fn of ["barrelDistort", "barrelScreenDistance", "crtScanlineBeam", "crtApertureGrille"]) {
      expect(declarations).toContain(`${keyword}${fn}(`);
      expect(main).toContain(`${fn}(`);
    }
  });

  it("a new Phosphor Mask starts on the aperture grille", () => {
    const node = blueprint.addNode(0, 0, NODE_TYPES.phosphorMask);
    expect(node.operation).toBe("aperture");
  });

  it.each(Object.entries(MASK_FUNCTIONS))(
    "the %s layout calls %s, and only it, in every target",
    (operation, fn) => {
      const shaders = buildChain(operation);
      for (const target of TARGETS) {
        const { main } = split(shaders[target], target);
        expect(main).toContain(`${fn}(`);
        for (const other of Object.values(MASK_FUNCTIONS)) {
          if (other !== fn) expect(main).not.toContain(`${other}(`);
        }
      }
    },
  );

  it("are named in every UI language", () => {
    const types = [NODE_TYPES.barrelDistort, NODE_TYPES.scanlines, NODE_TYPES.phosphorMask];
    for (const [lang, strings] of Object.entries(languages)) {
      for (const type of types) {
        expect(strings.nodes[type.name], `${lang}: node ${type.name}`).toBeTruthy();
        for (const port of [...type.inputs, ...type.outputs]) {
          expect(strings.inputOutputs[port.name], `${lang}: port ${port.name}`).toBeTruthy();
        }
        for (const tag of type.tags) {
          expect(strings.tags[tag], `${lang}: tag ${tag}`).toBeTruthy();
        }
      }
      for (const op of NODE_TYPES.phosphorMask.operationOptions) {
        expect(strings.operations[op.label], `${lang}: operation ${op.label}`).toBeTruthy();
      }
    }
  });
});
