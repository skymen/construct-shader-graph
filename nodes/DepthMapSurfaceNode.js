import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// A height map drawn into a layer (or an object) turned back into a surface.
// Height is dot(texel, Weights), in layout pixels, so the map can pack several
// terms into its channels (e.g. relief in R and a per-object offset in B).
// The normal is a Sobel gradient over a (2 * Radius + 1) texel footprint, wide
// enough to read through 8-bit steps, scaled into layout space through the
// layout rect.
//
// That rect has to run the same way as the texture, or positions come out
// mirrored in Y. The texture runs top to bottom on both backends, but on WebGL
// Construct's layout rect runs bottom to top (negative height). Measured on a
// layer effect in the cabin test: with the rect used as given, a light placed
// at the top lit the bottom. So the rect's Y is put top to bottom first.
// (Remapping a position over the same rect cancels the flip, which is why
// object-normalised maths never showed it; an absolute layout position doesn't.)
const glsl = (sample) => `float depthMapSurface_h(sampler2D s, highmedp vec2 uv, highmedp vec4 w) {
    return dot(${sample("s", "uv")}, w);
}

void depthMapSurface_calc(sampler2D s, highmedp vec2 uv, highmedp vec4 w, highmedp float radius,
                          out highmedp vec3 position, out highmedp vec3 normal, out highmedp float height) {
    highmedp vec2 t = pixelSize * max(radius, 0.5);
    highmedp float h00 = depthMapSurface_h(s, uv + vec2(-t.x, -t.y), w);
    highmedp float h10 = depthMapSurface_h(s, uv + vec2(0.0, -t.y), w);
    highmedp float h20 = depthMapSurface_h(s, uv + vec2(t.x, -t.y), w);
    highmedp float h01 = depthMapSurface_h(s, uv + vec2(-t.x, 0.0), w);
    highmedp float h21 = depthMapSurface_h(s, uv + vec2(t.x, 0.0), w);
    highmedp float h02 = depthMapSurface_h(s, uv + vec2(-t.x, t.y), w);
    highmedp float h12 = depthMapSurface_h(s, uv + vec2(0.0, t.y), w);
    highmedp float h22 = depthMapSurface_h(s, uv + vec2(t.x, t.y), w);
    height = depthMapSurface_h(s, uv, w);

    // the layout rect, running top to bottom like the texture
    highmedp vec2 la = layoutStart;
    highmedp vec2 lb = layoutEnd;
    if (lb.y < la.y) { la.y = layoutEnd.y; lb.y = layoutStart.y; }

    // layout pixels per unit of UV, signed per axis
    highmedp vec2 perUV = (lb - la) / (srcOriginEnd - srcOriginStart);
    highmedp float dx = ((h20 + 2.0 * h21 + h22) - (h00 + 2.0 * h01 + h02)) * 0.25 / (2.0 * t.x * perUV.x);
    highmedp float dy = ((h02 + 2.0 * h12 + h22) - (h00 + 2.0 * h10 + h20)) * 0.25 / (2.0 * t.y * perUV.y);
    normal = normalize(vec3(-dx, -dy, 1.0));
    position = vec3(mix(la, lb, (uv - srcOriginStart) / (srcOriginEnd - srcOriginStart)), height);
}`;

function textureNames(node, target) {
  const port = node.inputPorts[0];
  const meta = port?.connections?.[0]?.startPort?.node?.nodeType?.textureMetadata?.[target];
  if (target === "webgpu") {
    return { texture: meta?.textureName || "textureFront", sampler: meta?.samplerName || "samplerFront" };
  }
  return { sampler: meta?.samplerName || "samplerFront" };
}

const glslExec = (target) => (inputs, outputs, node) => {
  const { sampler } = textureNames(node, target);
  return `    vec3 ${outputs[0]};
    vec3 ${outputs[1]};
    float ${outputs[2]};
    depthMapSurface_calc(${sampler}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${outputs[0]}, ${outputs[1]}, ${outputs[2]});`;
};

export const DepthMapSurfaceNode = new NodeType(
  "Depth Map Surface",
  [
    { name: "Depth", type: "texture" },
    { name: "UV", type: "vec2" },
    { name: "Weights", type: "vec4", defaultValue: [100, 0, 0, 0] },
    { name: "Radius", type: "float", defaultValue: 3 },
  ],
  [
    { name: "Position", type: "vec3" },
    { name: "Normal", type: "vec3" },
    { name: "Height", type: "float" },
  ],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: glsl((s, uv) => `texture2D(${s}, ${uv})`),
      execution: glslExec("webgl1"),
    },
    webgl2: {
      dependency: glsl((s, uv) => `texture(${s}, ${uv})`),
      execution: glslExec("webgl2"),
    },
    webgpu: {
      dependency: `struct DepthMapSurface {
    position: vec3<f32>,
    normal: vec3<f32>,
    height: f32,
}

fn depthMapSurface_calc(tex: texture_2d<f32>, smp: sampler, uv: vec2<f32>, w: vec4<f32>, radius: f32) -> DepthMapSurface {
    let t = max(radius, 0.5) / vec2<f32>(textureDimensions(tex));
    let h00 = dot(textureSample(tex, smp, uv + vec2<f32>(-t.x, -t.y)), w);
    let h10 = dot(textureSample(tex, smp, uv + vec2<f32>(0.0, -t.y)), w);
    let h20 = dot(textureSample(tex, smp, uv + vec2<f32>(t.x, -t.y)), w);
    let h01 = dot(textureSample(tex, smp, uv + vec2<f32>(-t.x, 0.0)), w);
    let h21 = dot(textureSample(tex, smp, uv + vec2<f32>(t.x, 0.0)), w);
    let h02 = dot(textureSample(tex, smp, uv + vec2<f32>(-t.x, t.y)), w);
    let h12 = dot(textureSample(tex, smp, uv + vec2<f32>(0.0, t.y)), w);
    let h22 = dot(textureSample(tex, smp, uv + vec2<f32>(t.x, t.y)), w);
    let height = dot(textureSample(tex, smp, uv), w);

    // the layout rect, running top to bottom like the texture
    var la = c3Params.layoutStart;
    var lb = c3Params.layoutEnd;
    if (lb.y < la.y) { la.y = c3Params.layoutEnd.y; lb.y = c3Params.layoutStart.y; }

    // layout pixels per unit of UV, signed per axis
    let perUV = (lb - la) / (c3Params.srcOriginEnd - c3Params.srcOriginStart);
    let dx = ((h20 + 2.0 * h21 + h22) - (h00 + 2.0 * h01 + h02)) * 0.25 / (2.0 * t.x * perUV.x);
    let dy = ((h02 + 2.0 * h12 + h22) - (h00 + 2.0 * h10 + h20)) * 0.25 / (2.0 * t.y * perUV.y);
    var res: DepthMapSurface;
    res.normal = normalize(vec3<f32>(-dx, -dy, 1.0));
    res.position = vec3<f32>(mix(la, lb, (uv - c3Params.srcOriginStart) / (c3Params.srcOriginEnd - c3Params.srcOriginStart)), height);
    res.height = height;
    return res;
}`,
      execution: (inputs, outputs, node) => {
        const { texture, sampler } = textureNames(node, "webgpu");
        return `    let ${outputs[0]}_surface = depthMapSurface_calc(${texture}, ${sampler}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});
    var ${outputs[0]}: vec3<f32> = ${outputs[0]}_surface.position;
    var ${outputs[1]}: vec3<f32> = ${outputs[0]}_surface.normal;
    var ${outputs[2]}: f32 = ${outputs[0]}_surface.height;`;
      },
    },
  },
  "Lighting",
  ["depth", "height", "map", "normal", "surface", "position", "layer", "lighting", "sobel", "2d"]
);

DepthMapSurfaceNode.manual = {
  description:
    "Reads a height map (for example a layer of depth sprites drawn over the art) and returns each pixel's position in layout pixels and its surface normal. Feed both into Point Light.",
  html: `
    <div class="tip">
      <strong>Weights:</strong> height in layout pixels is dot(texel, Weights). (100, 0, 0, 0) reads red as 0 to 100 px. A map that packs relief in R and a per-object offset in B uses (relief, 0, offset, 0).
    </div>
    <div class="tip">
      <strong>Radius:</strong> how many texels apart the normal is measured. 8-bit maps step, and a radius of 2 to 4 smooths those steps out; 1 shows them as rings.
    </div>
    <div class="tip">
      <strong>Space:</strong> Position and Normal are in layout space: x right, y down, z toward the viewer. Light positions given in layout coordinates line up directly.
    </div>
  `,
};
