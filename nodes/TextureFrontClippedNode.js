import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// Front Texture, but reads outside the source rectangle come back transparent.
//
// When an effect chain takes C3's fast path, samplerFront IS the spritesheet and
// srcOrigin is only the current frame's rect inside it. Any UV distortion that
// leaves that rect samples whichever sprite the atlas packer put next door,
// which shows up as blocks of unrelated colour. Whether you see it depends on
// how the atlas happened to pack, so it can look fine on one machine and be
// broken on another.
//
// The sample is also inset by half a texel so bilinear filtering can't reach
// across the frame edge, while the inside test still uses the true rect - the
// sprite's own outermost row of pixels stays visible.
const GLSL = `vec4 sampleFrontClipped(vec2 uv) {
    vec2 lo = min(srcOriginStart, srcOriginEnd);
    vec2 hi = max(srcOriginStart, srcOriginEnd);
    vec2 inside = step(lo, uv) * step(uv, hi);
    vec2 safeUV = clamp(uv, lo + pixelSize * 0.5, max(lo, hi - pixelSize * 0.5));
    return SAMPLE_FRONT * (inside.x * inside.y);
}`;

export const TextureFrontClippedNode = new NodeType(
  "Front Texture (Clipped)",
  [{ name: "UV", type: "vec2" }],
  [
    { name: "RGBA", type: "vec4" },
    { name: "Color", type: "vec3" },
    { name: "Alpha", type: "float" },
  ],
  NODE_COLORS.textureSamplePreset,
  {
    webgl1: {
      dependency: GLSL.replace(
        "SAMPLE_FRONT",
        "texture2D(samplerFront, safeUV)"
      ),
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = sampleFrontClipped(${inputs[0]});\n` +
        `    vec3 ${outputs[1]} = ${outputs[0]}.xyz;\n` +
        `    float ${outputs[2]} = ${outputs[0]}.a;`,
    },
    webgl2: {
      dependency: GLSL.replace("SAMPLE_FRONT", "texture(samplerFront, safeUV)"),
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = sampleFrontClipped(${inputs[0]});\n` +
        `    vec3 ${outputs[1]} = ${outputs[0]}.xyz;\n` +
        `    float ${outputs[2]} = ${outputs[0]}.a;`,
    },
    webgpu: {
      dependency: `fn sampleFrontClipped(uv: vec2<f32>) -> vec4<f32> {
    let lo = min(c3Params.srcOriginStart, c3Params.srcOriginEnd);
    let hi = max(c3Params.srcOriginStart, c3Params.srcOriginEnd);
    let inside = step(lo, uv) * step(uv, hi);
    let texel = c3_getPixelSize(textureFront);
    let safeUV = clamp(uv, lo + texel * 0.5, max(lo, hi - texel * 0.5));
    return textureSample(textureFront, samplerFront, safeUV) * (inside.x * inside.y);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = sampleFrontClipped(${inputs[0]});\n` +
        `    var ${outputs[1]}: vec3<f32> = ${outputs[0]}.xyz;\n` +
        `    var ${outputs[2]}: f32 = ${outputs[0]}.a;`,
    },
  },
  "Texture",
  [
    "sample",
    "front",
    "texture",
    "clip",
    "clamp",
    "bleed",
    "spritesheet",
    "atlas",
    "bounds",
  ]
);
