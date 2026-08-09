// Rotation-safe layout-position nodes.
//
// C3 packs some sprite frames sideways into a spritesheet. The only trace in
// the shader is that srcOrigin becomes the frame's transposed box while the
// quad's texture coords are rotated to match, so the plain per-axis
// srcOrigin -> layout map comes out turned 90 degrees. WebGL never sees this
// (C3 forces a pre-draw when a shader reads a src rect and the source texture
// is rotated); WebGPU does, and exposes c3Params.isSrcTexRotated instead.
//
// Two invariants follow, and both are load-bearing:
//   - the WGSL must name isSrcTexRotated, because C3 only binds the value when
//     the shader source mentions it;
//   - the GLSL must stay byte-identical to the plain nodes, so swapping a graph
//     over cannot change what WebGL renders.

import { describe, it, expect, beforeAll } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let NODE_TYPES;

beforeAll(async () => {
  ({ NODE_TYPES } = await bootstrap());
});

const PAIRS = [
  ["getLayoutPos", "getLayoutPosRotationSafe"],
  ["fromLayoutPos", "fromLayoutPosRotationSafe"],
];

function emit(nodeType, target) {
  const execution = nodeType.getExecution(target);
  return execution(["in_uv"], ["out_uv"]);
}

describe("rotation-safe layout position nodes", () => {
  it("are registered", () => {
    for (const [, safeKey] of PAIRS) {
      expect(NODE_TYPES[safeKey]).toBeTruthy();
    }
  });

  it.each(PAIRS)("%s and %s emit identical GLSL", (plainKey, safeKey) => {
    for (const target of ["webgl1", "webgl2"]) {
      expect(emit(NODE_TYPES[safeKey], target)).toBe(
        emit(NODE_TYPES[plainKey], target),
      );
      expect(NODE_TYPES[safeKey].getDependency(target)).toBe("");
    }
  });

  it.each(PAIRS)(
    "%s -> %s only changes the WGSL, and names isSrcTexRotated",
    (plainKey, safeKey) => {
      const safe = NODE_TYPES[safeKey];
      const wgsl = emit(safe, "webgpu") + safe.getDependency("webgpu");

      expect(wgsl).not.toBe(emit(NODE_TYPES[plainKey], "webgpu"));
      // C3 binds the uniform only if the source mentions it by name.
      expect(wgsl).toContain("isSrcTexRotated");
      expect(safe.getDependency("webgpu")).toContain("c3Params.srcOriginStart");
    },
  );

  it("the two WGSL helpers invert each other", () => {
    // getLayoutPos maps texture-normalised n onto object-normalised (n.y, 1-n.x);
    // fromLayoutPos must map object-normalised o back onto (1-o.y, o.x).
    const forward = (n) => [n[1], 1 - n[0]];
    const inverse = (o) => [1 - o[1], o[0]];

    for (const n of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.25, 0.75],
    ]) {
      const round = inverse(forward(n));
      expect(round[0]).toBeCloseTo(n[0], 10);
      expect(round[1]).toBeCloseTo(n[1], 10);
    }

    expect(NODE_TYPES.getLayoutPosRotationSafe.getDependency("webgpu")).toContain(
      "vec2<f32>(n.y, 1.0 - n.x)",
    );
    expect(
      NODE_TYPES.fromLayoutPosRotationSafe.getDependency("webgpu"),
    ).toContain("vec2<f32>(1.0 - o.y, o.x)");
  });
});
