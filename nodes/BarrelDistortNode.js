import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// CRT-style barrel distortion, plus the zoom that hides the bars it opens up.
//
// r² is measured in aspect-correct space and normalised to exactly 1 at the
// corners. On every edge r² <= 1, so dividing by (1 + k) - Fill = 1 - is the
// smallest zoom that leaves no black anywhere, whatever the curvature.
//
// Mask and Distance describe the curved screen edge. The box is scaled so its
// shorter half-side is 1, which puts Corner Radius and Softness in fractions of
// that half-side on any aspect ratio. Aspect only matters as a ratio: a raw size
// and the output of Aspect Correct give the same result.
const GLSL_DEPENDENCY = `highmedp vec2 barrelDistort(highmedp vec2 uv, highmedp float curvature, highmedp float fillAmount, highmedp vec2 aspect) {
    highmedp vec2 p = uv * 2.0 - 1.0;
    highmedp vec2 pa = p * aspect;
    highmedp float r2 = dot(pa, pa) / max(dot(aspect, aspect), 0.00001);
    return p * (1.0 + curvature * r2) / (1.0 + curvature * fillAmount) * 0.5 + 0.5;
}

highmedp float barrelScreenDistance(highmedp vec2 uv, highmedp vec2 aspect, highmedp float radius) {
    highmedp vec2 b = abs(aspect) / max(min(abs(aspect.x), abs(aspect.y)), 0.00001);
    highmedp vec2 q = abs((uv * 2.0 - 1.0) * b) - b + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}`;

const glslExecution = (inputs, outputs) =>
  `    highmedp vec2 ${outputs[0]} = barrelDistort(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});
    highmedp float ${outputs[2]} = barrelScreenDistance(${outputs[0]}, ${inputs[3]}, ${inputs[4]});
    float ${outputs[1]} = 1.0 - smoothstep(-max(${inputs[5]}, 0.00001), 0.0, ${outputs[2]});`;

export const BarrelDistortNode = new NodeType(
  "Barrel Distort",
  [
    { name: "UV", type: "vec2" },
    { name: "Curvature", type: "float", defaultValue: 0.2 },
    { name: "Fill", type: "float", defaultValue: 1.0 },
    { name: "Aspect", type: "vec2", defaultValue: [1, 1] },
    { name: "Corner Radius", type: "float", defaultValue: 0.05 },
    { name: "Softness", type: "float", defaultValue: 0.006 },
  ],
  [
    { name: "UV", type: "vec2" },
    { name: "Mask", type: "float" },
    { name: "Distance", type: "float" },
  ],
  NODE_COLORS.uvDistort,
  {
    webgl1: {
      dependency: GLSL_DEPENDENCY,
      execution: glslExecution,
    },
    webgl2: {
      dependency: GLSL_DEPENDENCY,
      execution: glslExecution,
    },
    webgpu: {
      dependency: `fn barrelDistort(uv: vec2<f32>, curvature: f32, fillAmount: f32, aspect: vec2<f32>) -> vec2<f32> {
    let p = uv * 2.0 - 1.0;
    let pa = p * aspect;
    let r2 = dot(pa, pa) / max(dot(aspect, aspect), 0.00001);
    return p * (1.0 + curvature * r2) / (1.0 + curvature * fillAmount) * 0.5 + 0.5;
}

fn barrelScreenDistance(uv: vec2<f32>, aspect: vec2<f32>, radius: f32) -> f32 {
    let b = abs(aspect) / max(min(abs(aspect.x), abs(aspect.y)), 0.00001);
    let q = abs((uv * 2.0 - 1.0) * b) - b + radius;
    return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = barrelDistort(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});
    var ${outputs[2]}: f32 = barrelScreenDistance(${outputs[0]}, ${inputs[3]}, ${inputs[4]});
    var ${outputs[1]}: f32 = 1.0 - smoothstep(-max(${inputs[5]}, 0.00001), 0.0, ${outputs[2]});`,
    },
  },
  "UV",
  ["barrel", "crt", "curvature", "distortion", "lens", "monitor", "tv", "screen", "retro", "fisheye", "uv"]
);

BarrelDistortNode.manual = {
  description:
    "Curves normalised coordinates the way a CRT's bulging glass does, zooms in to hide the black bars that opens up, and describes the curved screen edge.",
  html: `
    <h4>Formula</h4>
    <pre><code>p   = 2·UV − 1
r²  = |p·Aspect|² / |Aspect|²          // 0 at the centre, 1 at the corners
UV′ = (p · (1 + Curvature·r²) / (1 + Curvature·Fill)) / 2 + 0.5</code></pre>

    <h4>Inputs</h4>
    <ul>
      <li><strong>UV</strong> — normalised 0..1 coordinates, usually <code>srcOriginToNorm</code> of Front UV.</li>
      <li><strong>Curvature</strong> — how strongly the picture bulges. 0 is flat.</li>
      <li><strong>Fill</strong> — the zoom that hides the bars. 0 shows them all; 1 is the smallest zoom that
        leaves none, for any curvature; in between only the corners go dark.</li>
      <li><strong>Aspect</strong> — the shape of the screen, so the bulge is round rather than stretched. Any
        size works, since only the ratio matters: <code>layoutSize</code>, <code>srcOriginSizePx</code>
        or <code>Aspect Correct</code>.</li>
      <li><strong>Corner Radius</strong>, <strong>Softness</strong> — shape the screen edge, in fractions of half
        the shorter side.</li>
    </ul>

    <h4>Outputs</h4>
    <ul>
      <li><strong>UV</strong> — where to read the picture. Remap it to <code>destStart..destEnd</code> for
        <code>Back Texture</code>, or <code>normToSrcOrigin</code> for <code>Front Texture</code>.</li>
      <li><strong>Mask</strong> — 1 on the screen, 0 past its curved edge. Multiply the colour by it to draw
        the black surround.</li>
      <li><strong>Distance</strong> — signed distance to the screen edge, negative inside. Useful for a bezel
        glow or reflection.</li>
    </ul>

    <h4>What Fill costs</h4>
    <p>
      The picture lost to the zoom is greatest at the middle of each edge, not the corners. At Curvature 0.2 on
      a 16:9 screen, the top and bottom each lose about 6% of the height and the sides about 2% of the width.
      Keep a game's HUD out of that margin.
    </p>

    <div class="tip">
      Pair it with <code>Scanlines</code> and <code>Phosphor Mask</code>, fed the distorted UV so the lines
      bow with the picture.
    </div>
  `,
};
