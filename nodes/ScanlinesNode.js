import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// CRT scanlines: each line is a gaussian beam profile across its height, and
// the beam widens on bright pixels the way a real electron beam blooms. Dark
// rows get thin lines with deep gaps; bright rows nearly close the gap.
//
// The phase math is highmedp on purpose: fract(uv.y * lines) at a few hundred
// lines needs more than mediump's 10 bits, or the beam profile bands.
const GLSL_DEPENDENCY = `highmedp float crtScanlineBeam(vec3 color, highmedp vec2 uv, highmedp float lines, highmedp float intensity) {
    highmedp float lum = dot(clamp(color, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
    highmedp float f = fract(uv.y * lines) - 0.5;
    highmedp float w = mix(0.22, 0.42, sqrt(lum));
    highmedp float beam = exp(-(f * f) / (2.0 * w * w));
    return mix(1.0, beam, intensity);
}`;

const glslExecution = (inputs, outputs) =>
  `    highmedp float ${outputs[1]} = crtScanlineBeam(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});
    vec3 ${outputs[0]} = ${inputs[0]} * ${outputs[1]};`;

export const ScanlinesNode = new NodeType(
  "Scanlines",
  [
    { name: "Color", type: "vec3" },
    { name: "UV", type: "vec2" },
    { name: "Lines", type: "float", defaultValue: 240 },
    { name: "Intensity", type: "float", defaultValue: 0.5 },
  ],
  [
    { name: "Color", type: "vec3" },
    { name: "Beam", type: "float" },
  ],
  NODE_COLORS.colorBlend,
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
      dependency: `fn crtScanlineBeam(color: vec3<f32>, uv: vec2<f32>, lines: f32, intensity: f32) -> f32 {
    let lum = dot(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(0.299, 0.587, 0.114));
    let f = fract(uv.y * lines) - 0.5;
    let w = mix(0.22, 0.42, sqrt(lum));
    let beam = exp(-(f * f) / (2.0 * w * w));
    return mix(1.0, beam, intensity);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[1]}: f32 = crtScanlineBeam(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});
    var ${outputs[0]}: vec3<f32> = ${inputs[0]} * ${outputs[1]};`,
    },
  },
  "Color",
  ["scanlines", "scanline", "crt", "retro", "monitor", "tv", "beam", "lines", "arcade", "vintage"]
);

ScanlinesNode.manual = {
  description:
    "Darkens the gaps between a CRT's horizontal lines. Each line is a soft beam that widens on bright pixels, so highlights stay bright while dark areas show deep gaps.",
  html: `
    <h4>Formula</h4>
    <pre><code>f     = fract(UV.y · Lines) − 0.5      // −0.5..0.5 across one line
width = mix(0.22, 0.42, sqrt(luminance(Color)))
Beam  = mix(1, exp(−f² / (2·width²)), Intensity)
Color = Color · Beam</code></pre>

    <h4>Inputs</h4>
    <ul>
      <li><strong>Color</strong> — the picture. Its brightness sets how wide each beam is.</li>
      <li><strong>UV</strong> — normalised coordinates. Feed the distorted UV from <code>Barrel Distort</code>
        so the lines bow with the picture.</li>
      <li><strong>Lines</strong> — how many lines cover UV 0..1. For one line per game pixel on a full-screen
        sprite, use the object's height in layout pixels (<code>layoutSize.y</code>).</li>
      <li><strong>Intensity</strong> — 0 leaves the colour untouched, 1 gives the full beam profile.</li>
    </ul>

    <h4>Outputs</h4>
    <ul>
      <li><strong>Color</strong> — the colour with scanlines applied.</li>
      <li><strong>Beam</strong> — the multiplier on its own, to apply elsewhere or to preview.</li>
    </ul>

    <div class="tip">
      Scanlines darken the picture overall. A brightness multiply of about 1.1–1.3 afterwards wins it back.
    </div>
  `,
};
