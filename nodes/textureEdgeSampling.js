// Shared edge handling for the preset texture samplers (Front / Back).
//
// Three modes, chosen from the node's operation dropdown at codegen time:
//
//   Raw    sample wherever the UV points
//   Clamp  pin out-of-bounds UVs to the edge, so they return the border pixel
//   Clip   return transparent outside the bounds
//
// Clamp and Clip are genuinely different results, not two spellings of one
// thing: clamp smears the border pixel outward, clip cuts to nothing. What they
// share is the bounds test, so they share a builder.
//
// The bounds differ per sampler and are NOT interchangeable:
//
//   Front  srcOrigin — the current frame's rect inside the spritesheet
//   Back   dest      — the object's rect on the layout render surface
//
// Only Front gets a half-texel inset. That inset exists because on C3's fast
// path samplerFront is the whole spritesheet: a bilinear tap at exactly the
// frame boundary blends 50/50 with whatever sprite the atlas packer put next
// door, so clamping to the exact rect still bleeds. The back texture is a
// render surface rather than an atlas, so a tap at its edge picks up ordinary
// neighbouring background, not a foreign sprite - there is nothing to fix.
// (WebGL 1 and 2 also expose only a front-texture `pixelSize`, so a back inset
// would exist on WebGPU alone and make the targets disagree.)

export const EDGE_OPTIONS = [
  { value: "raw", label: "Raw" },
  { value: "clamp", label: "Clamp" },
  { value: "clip", label: "Clip" },
];

// Locals are suffixed off the node's own output variable, which codegen already
// guarantees unique, so two samplers in one shader cannot collide.
function buildGLSL({ start, end, texel, sample }) {
  return (inputs, outputs, node) => {
    const mode = node?.operation || "raw";
    const uv = inputs[0];
    const rgba = outputs[0];
    const tail =
      `    vec3 ${outputs[1]} = ${rgba}.xyz;\n` +
      `    float ${outputs[2]} = ${rgba}.a;`;

    if (mode === "raw") {
      return `    vec4 ${rgba} = ${sample(uv)};\n` + tail;
    }

    const lo = `${rgba}_lo`;
    const hi = `${rgba}_hi`;
    const safe = `${rgba}_uv`;
    let head =
      `    vec2 ${lo} = min(${start}, ${end});\n` +
      `    vec2 ${hi} = max(${start}, ${end});\n`;

    if (mode === "clip") {
      head += `    vec2 ${rgba}_inside = step(${lo}, ${uv}) * step(${uv}, ${hi});\n`;
    }

    if (texel) {
      // Inset the amount, not the bound: on a frame thinner than one texel,
      // insetting the bound would push the lower past the upper and GLSL
      // clamp() with minVal > maxVal is undefined.
      const inset = `${rgba}_inset`;
      head +=
        `    vec2 ${inset} = min(${texel} * 0.5, (${hi} - ${lo}) * 0.5);\n` +
        `    vec2 ${safe} = clamp(${uv}, ${lo} + ${inset}, ${hi} - ${inset});\n`;
    } else {
      head += `    vec2 ${safe} = clamp(${uv}, ${lo}, ${hi});\n`;
    }

    const masked =
      mode === "clip"
        ? `${sample(safe)} * (${rgba}_inside.x * ${rgba}_inside.y)`
        : sample(safe);

    return head + `    vec4 ${rgba} = ${masked};\n` + tail;
  };
}

function buildWGSL({ start, end, texel, sample }) {
  return (inputs, outputs, node) => {
    const mode = node?.operation || "raw";
    const uv = inputs[0];
    const rgba = outputs[0];
    const tail =
      `    var ${outputs[1]}: vec3<f32> = ${rgba}.xyz;\n` +
      `    var ${outputs[2]}: f32 = ${rgba}.a;`;

    if (mode === "raw") {
      return `    var ${rgba}: vec4<f32> = ${sample(uv)};\n` + tail;
    }

    const lo = `${rgba}_lo`;
    const hi = `${rgba}_hi`;
    const safe = `${rgba}_uv`;
    let head =
      `    let ${lo} = min(${start}, ${end});\n` +
      `    let ${hi} = max(${start}, ${end});\n`;

    if (mode === "clip") {
      head += `    let ${rgba}_inside = step(${lo}, ${uv}) * step(${uv}, ${hi});\n`;
    }

    if (texel) {
      const inset = `${rgba}_inset`;
      head +=
        `    let ${inset} = min(${texel} * 0.5, (${hi} - ${lo}) * 0.5);\n` +
        `    let ${safe} = clamp(${uv}, ${lo} + ${inset}, ${hi} - ${inset});\n`;
    } else {
      head += `    let ${safe} = clamp(${uv}, ${lo}, ${hi});\n`;
    }

    const masked =
      mode === "clip"
        ? `${sample(safe)} * (${rgba}_inside.x * ${rgba}_inside.y)`
        : sample(safe);

    return head + `    var ${rgba}: vec4<f32> = ${masked};\n` + tail;
  };
}

/**
 * Build the three-target shaderCode block for a preset texture sampler.
 *
 * `texel` is optional on each target: omit it to clamp to the exact bounds
 * with no half-texel inset.
 */
export function buildEdgeSampledTexture({ glsl, wgsl }) {
  return {
    webgl1: {
      dependency: "",
      execution: buildGLSL({ ...glsl, sample: glsl.sampleWebgl1 }),
    },
    webgl2: {
      dependency: "",
      execution: buildGLSL({ ...glsl, sample: glsl.sampleWebgl2 }),
    },
    webgpu: {
      dependency: "",
      execution: buildWGSL(wgsl),
    },
  };
}
