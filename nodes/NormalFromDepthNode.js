import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// Rebuilds the view-space position of each depth sample, then crosses the
// position differences. Depth differences alone are in scene units while the
// UV step is not, which bends every normal towards the screen plane.
//
// The depth buffer covers the whole canvas, so UV 0..1 spans the frustum and
// its texture size gives the aspect ratio. WebGL render targets run bottom to
// top and WebGPU ones top to bottom, so each target says which way is up.
const glsl = (sample, textureSizeExpr) => `highmedp vec3 normalFromDepth_viewPos(highmedp vec2 uv, highmedp vec2 viewScale) {
    highmedp float depthSample = ${sample("uv")};
    highmedp float z = zNear * zFar / (zFar + depthSample * (zNear - zFar));
    return vec3((uv * 2.0 - 1.0) * viewScale * z, -z);
}

vec3 normalFromDepth_calc(highmedp vec2 uv, highmedp float radius, highmedp float fov) {
    highmedp vec2 size = ${textureSizeExpr};
    highmedp float t = tan(radians(fov) * 0.5);
    highmedp vec2 viewScale = vec2(t * size.x / size.y, t);

    highmedp vec3 p     = normalFromDepth_viewPos(uv, viewScale);
    highmedp vec3 left  = normalFromDepth_viewPos(uv + vec2(-radius, 0.0), viewScale);
    highmedp vec3 right = normalFromDepth_viewPos(uv + vec2( radius, 0.0), viewScale);
    highmedp vec3 down  = normalFromDepth_viewPos(uv + vec2(0.0, -radius), viewScale);
    highmedp vec3 up    = normalFromDepth_viewPos(uv + vec2(0.0,  radius), viewScale);

    // One-sided differences: take the neighbour on the same surface, so a
    // silhouette doesn't pick up a normal from the jump to what is behind it
    highmedp vec3 dx = abs(right.z - p.z) < abs(p.z - left.z) ? right - p : p - left;
    highmedp vec3 dy = abs(up.z - p.z) < abs(p.z - down.z) ? up - p : p - down;

    // View space: +x right, +y up, +z towards the camera. Packed to 0-1
    vec3 normal = normalize(cross(dx, dy));
    return normal * 0.5 + 0.5;
}`;

export const NormalFromDepthNode = new NodeType(
  "Normal From Depth",
  [
    { name: "UV", type: "vec2" },
    { name: "Radius", type: "float", defaultValue: 0.001 },
    { name: "FOV", type: "float", defaultValue: 60.0 },
  ],
  [{ name: "Normal", type: "vec3" }],
  NODE_COLORS.textureSamplePreset,
  {
    webgl1: {
      // No textureSize in GLSL ES 1.00. A depth-sampling effect is pre-drawn
      // to a canvas-sized target, so the source pixel size has the same aspect
      dependency: glsl(
        (uv) => `texture2D(samplerDepth, ${uv}).r`,
        "vec2(1.0) / pixelSize",
      ),
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalFromDepth_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: glsl(
        (uv) => `texture(samplerDepth, ${uv}).r`,
        "vec2(textureSize(samplerDepth, 0))",
      ),
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalFromDepth_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn normalFromDepth_viewPos(uv: vec2<f32>, viewScale: vec2<f32>) -> vec3<f32> {
    let z = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv));
    // WebGPU textures run top to bottom, so screen up is -v
    return vec3<f32>((uv * 2.0 - 1.0) * vec2<f32>(1.0, -1.0) * viewScale * z, -z);
}

fn normalFromDepth_calc(uv: vec2<f32>, radius: f32, fov: f32) -> vec3<f32> {
    let size = vec2<f32>(textureDimensions(textureDepth));
    let t = tan(radians(fov) * 0.5);
    let viewScale = vec2<f32>(t * size.x / size.y, t);

    let p     = normalFromDepth_viewPos(uv, viewScale);
    let left  = normalFromDepth_viewPos(uv + vec2<f32>(-radius, 0.0), viewScale);
    let right = normalFromDepth_viewPos(uv + vec2<f32>( radius, 0.0), viewScale);
    let down  = normalFromDepth_viewPos(uv + vec2<f32>(0.0,  radius), viewScale);
    let up    = normalFromDepth_viewPos(uv + vec2<f32>(0.0, -radius), viewScale);

    // One-sided differences: take the neighbour on the same surface, so a
    // silhouette doesn't pick up a normal from the jump to what is behind it
    let dx = select(p - left, right - p, abs(right.z - p.z) < abs(p.z - left.z));
    let dy = select(p - down, up - p, abs(up.z - p.z) < abs(p.z - down.z));

    // View space: +x right, +y up, +z towards the camera. Packed to 0-1
    let normal = normalize(cross(dx, dy));
    return normal * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = normalFromDepth_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "Lighting",
  [
    "normal",
    "depth",
    "surface",
    "gradient",
    "reconstruct",
    "z-buffer",
    "lighting",
    "shading",
  ]
);

// Manual documentation
NormalFromDepthNode.manual = {
  description:
    "Reconstructs view-space surface normals from the depth buffer. Each depth sample is turned back into a 3D position using the camera's field of view, and the normal comes from the positions around the UV. Output is packed to the 0-1 range.",
  html: `
    <div class="tip">
      <strong>FOV:</strong> Set this to the project's Field of view (60 by default). A wrong value tilts every normal towards or away from the screen.
    </div>
    <div class="tip">
      <strong>Radius:</strong> The sampling distance in UV. Around one pixel keeps the most detail; larger values smooth out noise but round off small shapes.
    </div>
    <div class="tip">
      <strong>Note:</strong> +X is right, +Y is up and +Z faces the camera. A flat surface facing the camera is (0.5, 0.5, 1.0), light blue. In a 2D layout everything sits at the same depth, so the whole screen comes out flat.
    </div>
  `,
};
