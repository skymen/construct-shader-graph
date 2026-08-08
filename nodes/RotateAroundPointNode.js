import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// Aspect is a trailing input defaulting to (1,1). Unconnected editable inputs
// are inlined as literal constants at the call site, so the default emits
// `vec2(1.0, 1.0)` and the whole safeAspect / multiply / divide folds away —
// a plain rotation costs exactly what it did before Aspect existed.
const GLSL = `vec2 rotateAroundPoint(vec2 uv, vec2 center, float angle, vec2 aspect) {
    vec2 safeAspect = max(abs(aspect), vec2(0.00001));
    vec2 dir = (uv - center) * safeAspect;
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return center + (rot * dir) / safeAspect;
}`;

const WGSL = `fn rotateAroundPoint(uv: vec2<f32>, center: vec2<f32>, angle: f32, aspect: vec2<f32>) -> vec2<f32> {
    let safeAspect = max(abs(aspect), vec2<f32>(0.00001));
    let dir = (uv - center) * safeAspect;
    let s = sin(angle);
    let c = cos(angle);
    let rot = mat2x2<f32>(c, -s, s, c);
    return center + (rot * dir) / safeAspect;
}`;

export const RotateAroundPointNode = new NodeType(
  "Rotate Around Point",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Angle", type: "float" },
    { name: "Aspect", type: "vec2", defaultValue: [1, 1] },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: WGSL,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Vector",
  ["rotate", "rotation", "pivot", "transform", "uv", "aspect", "ratio"]
);

RotateAroundPointNode.manual = {
  description:
    "Rotates a UV coordinate around a pivot point by an angle in radians. The optional Aspect input compensates for non-square frames, so the rotation stays circular instead of skewing into an ellipse.",
  html: `
    <h4>Inputs</h4>
    <ul>
      <li><code>UV</code> — the coordinate to rotate</li>
      <li><code>Center</code> — the pivot to rotate around</li>
      <li><code>Angle</code> — rotation in <strong>radians</strong>, counter-clockwise</li>
      <li><code>Aspect</code> — axis weighting, default <code>(1, 1)</code> for no correction</li>
    </ul>

    <h4>Why Aspect matters</h4>
    <p>
      UV space is always 0..1 on both axes, but a frame is rarely square. Rotating raw UVs on a
      200&times;100 frame stretches the rotation horizontally. Feeding an aspect vector scales the
      offset before rotating and unscales it after, which keeps circles circular.
    </p>

    <h4>Typical wiring</h4>
    <pre><code>srcOriginSizePx -> Aspect Correct -> Aspect</code></pre>

    <div class="tip">
      Leave <code>Aspect</code> unconnected for a plain rotation. The default is a compile-time
      constant, so the correction math is folded away entirely and costs nothing.
    </div>
  `,
};
