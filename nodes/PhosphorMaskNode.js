import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// The red, green and blue phosphor pattern of a CRT's face.
//
// Cell coordinates are UV * Cells: one cell is one RGB triad across and one
// mask row down. Each phosphor stripe covers a third of a cell, with a soft
// edge so small triads don't alias. Lit stripes are pushed above 1 and unlit
// ones well below, so a mid-grey keeps roughly its brightness while
// saturated colours pick up the pattern. The three layouts differ only in
// how rows are staggered and gapped.
const GLSL_DEPENDENCY = `vec3 crtPhosphorStripes(highmedp float x) {
    highmedp vec3 d = abs(fract(vec3(x) - vec3(1.0, 3.0, 5.0) / 6.0 + 0.5) - 0.5);
    return 1.0 - smoothstep(vec3(1.0 / 6.0 - 0.07), vec3(1.0 / 6.0 + 0.07), d);
}

vec3 crtPhosphorLevels(vec3 lit, highmedp float intensity) {
    return mix(vec3(1.0), mix(vec3(0.3), vec3(1.55), lit), intensity);
}

vec3 crtApertureGrille(highmedp vec2 cell, highmedp float intensity) {
    return crtPhosphorLevels(crtPhosphorStripes(cell.x), intensity);
}

vec3 crtSlotMask(highmedp vec2 cell, highmedp float intensity) {
    highmedp float y = fract(cell.y * 0.5 + 0.5 * mod(floor(cell.x), 2.0));
    float rowGate = 1.0 - smoothstep(0.36, 0.48, abs(y - 0.5));
    return crtPhosphorLevels(crtPhosphorStripes(cell.x) * rowGate, intensity);
}

vec3 crtShadowMask(highmedp vec2 cell, highmedp float intensity) {
    highmedp float x = cell.x + 0.5 * mod(floor(cell.y), 2.0);
    float rowGate = 1.0 - smoothstep(0.30, 0.48, abs(fract(cell.y) - 0.5));
    return crtPhosphorLevels(crtPhosphorStripes(x) * rowGate, intensity);
}`;

const MASK_FUNCTIONS = {
  aperture: "crtApertureGrille",
  slot: "crtSlotMask",
  shadow: "crtShadowMask",
};
const maskFunction = (node) =>
  MASK_FUNCTIONS[node?.operation] || MASK_FUNCTIONS.aperture;

const glslExecution = (inputs, outputs, node) =>
  `    vec3 ${outputs[1]} = ${maskFunction(node)}((${inputs[1]}) * (${inputs[2]}), ${inputs[3]});
    vec3 ${outputs[0]} = ${inputs[0]} * ${outputs[1]};`;

export const PhosphorMaskNode = new NodeType(
  "Phosphor Mask",
  [
    { name: "Color", type: "vec3" },
    { name: "UV", type: "vec2" },
    { name: "Cells", type: "vec2", defaultValue: [320, 180] },
    { name: "Intensity", type: "float", defaultValue: 0.4 },
  ],
  [
    { name: "Color", type: "vec3" },
    { name: "Mask", type: "vec3" },
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
      dependency: `fn crtPhosphorStripes(x: f32) -> vec3<f32> {
    let d = abs(fract(vec3<f32>(x) - vec3<f32>(1.0, 3.0, 5.0) / 6.0 + 0.5) - 0.5);
    return 1.0 - smoothstep(vec3<f32>(1.0 / 6.0 - 0.07), vec3<f32>(1.0 / 6.0 + 0.07), d);
}

fn crtPhosphorLevels(lit: vec3<f32>, intensity: f32) -> vec3<f32> {
    return mix(vec3<f32>(1.0), mix(vec3<f32>(0.3), vec3<f32>(1.55), lit), intensity);
}

fn crtApertureGrille(cell: vec2<f32>, intensity: f32) -> vec3<f32> {
    return crtPhosphorLevels(crtPhosphorStripes(cell.x), intensity);
}

fn crtSlotMask(cell: vec2<f32>, intensity: f32) -> vec3<f32> {
    let columnIndex = floor(cell.x);
    let y = fract(cell.y * 0.5 + 0.5 * (columnIndex - 2.0 * floor(columnIndex * 0.5)));
    let rowGate = 1.0 - smoothstep(0.36, 0.48, abs(y - 0.5));
    return crtPhosphorLevels(crtPhosphorStripes(cell.x) * rowGate, intensity);
}

fn crtShadowMask(cell: vec2<f32>, intensity: f32) -> vec3<f32> {
    let rowIndex = floor(cell.y);
    let x = cell.x + 0.5 * (rowIndex - 2.0 * floor(rowIndex * 0.5));
    let rowGate = 1.0 - smoothstep(0.30, 0.48, abs(fract(cell.y) - 0.5));
    return crtPhosphorLevels(crtPhosphorStripes(x) * rowGate, intensity);
}`,
      execution: (inputs, outputs, node) =>
        `    var ${outputs[1]}: vec3<f32> = ${maskFunction(node)}((${inputs[1]}) * (${inputs[2]}), ${inputs[3]});
    var ${outputs[0]}: vec3<f32> = ${inputs[0]} * ${outputs[1]};`,
    },
  },
  "Color",
  ["phosphor", "mask", "crt", "aperture", "grille", "slot", "shadow", "triad", "rgb", "subpixel", "monitor", "tv", "retro", "arcade"]
);

PhosphorMaskNode.hasOperation = true;
PhosphorMaskNode.operationOptions = [
  { value: "aperture", label: "Aperture Grille" },
  { value: "slot", label: "Slot Mask" },
  { value: "shadow", label: "Shadow Mask" },
];

PhosphorMaskNode.manual = {
  description:
    "Multiplies the picture by a CRT's red, green and blue phosphor pattern. The dropdown picks the layout: aperture grille stripes, a slot mask, or shadow-mask dot triads.",
  html: `
    <h4>Layouts</h4>
    <ul>
      <li><strong>Aperture Grille</strong> — continuous vertical R, G, B stripes (Trinitron-style). The cleanest look.</li>
      <li><strong>Slot Mask</strong> — the same stripes cut into short slots, alternate columns offset by half a slot.</li>
      <li><strong>Shadow Mask</strong> — dot triads, every other row shifted by half a triad.</li>
    </ul>

    <h4>Inputs</h4>
    <ul>
      <li><strong>Color</strong> — the picture.</li>
      <li><strong>UV</strong> — normalised coordinates. Distorted UV makes the mask curve with the tube; the
        undistorted UV keeps it flat, aligned to the display's pixels, which avoids moiré when triads are
        only a few pixels wide.</li>
      <li><strong>Cells</strong> — how many triads across and mask rows down cover UV 0..1. One triad per game
        pixel is <code>layoutSize</code> on a full-screen sprite.</li>
      <li><strong>Intensity</strong> — 0 leaves the colour untouched, 1 is the full pattern.</li>
    </ul>

    <h4>Outputs</h4>
    <ul>
      <li><strong>Color</strong> — the colour with the mask applied.</li>
      <li><strong>Mask</strong> — the RGB multiplier on its own.</li>
    </ul>

    <h4>Brightness</h4>
    <p>
      Lit phosphors are pushed to 1.55 and unlit ones down to 0.3, so mid-tones keep roughly their brightness
      but pure white loses some. A brightness multiply afterwards wins it back.
    </p>
  `,
};
