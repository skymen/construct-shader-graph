import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const NormalFromDepthNode = new NodeType(
  "Normal From Depth",
  [
    { name: "UV", type: "vec2" },
    { name: "Radius", type: "float", defaultValue: 0.001 },
  ],
  [{ name: "Normal", type: "vec3" }],
  NODE_COLORS.textureSamplePreset,
  {
    webgl1: {
      dependency: `float normalFromDepth_linearize(float depthSample) {
    return zNear * zFar / (zFar + depthSample * (zNear - zFar));
}

vec3 normalFromDepth_calc(vec2 uv, float radius) {
    // Sample depth at center and 4 neighboring points
    float depthCenter = normalFromDepth_linearize(texture2D(samplerDepth, uv).r);
    float depthLeft   = normalFromDepth_linearize(texture2D(samplerDepth, uv + vec2(-radius, 0.0)).r);
    float depthRight  = normalFromDepth_linearize(texture2D(samplerDepth, uv + vec2( radius, 0.0)).r);
    float depthUp     = normalFromDepth_linearize(texture2D(samplerDepth, uv + vec2(0.0,  radius)).r);
    float depthDown   = normalFromDepth_linearize(texture2D(samplerDepth, uv + vec2(0.0, -radius)).r);
    
    // Calculate gradients using central differences
    float dzdx = (depthRight - depthLeft) / (2.0 * radius);
    float dzdy = (depthUp - depthDown) / (2.0 * radius);
    
    // Construct normal from gradients and remap to 0-1 range for visualization
    // Raw normal would be: normalize(vec3(-dzdx, -dzdy, 1.0))
    // Remapped: normal * 0.5 + 0.5
    vec3 normal = normalize(vec3(-dzdx, -dzdy, 1.0));
    return normal * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalFromDepth_calc(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: `float normalFromDepth_linearize(float depthSample) {
    return zNear * zFar / (zFar + depthSample * (zNear - zFar));
}

vec3 normalFromDepth_calc(vec2 uv, float radius) {
    // Sample depth at center and 4 neighboring points
    float depthCenter = normalFromDepth_linearize(texture(samplerDepth, uv).r);
    float depthLeft   = normalFromDepth_linearize(texture(samplerDepth, uv + vec2(-radius, 0.0)).r);
    float depthRight  = normalFromDepth_linearize(texture(samplerDepth, uv + vec2( radius, 0.0)).r);
    float depthUp     = normalFromDepth_linearize(texture(samplerDepth, uv + vec2(0.0,  radius)).r);
    float depthDown   = normalFromDepth_linearize(texture(samplerDepth, uv + vec2(0.0, -radius)).r);
    
    // Calculate gradients using central differences
    float dzdx = (depthRight - depthLeft) / (2.0 * radius);
    float dzdy = (depthUp - depthDown) / (2.0 * radius);
    
    // Construct normal from gradients and remap to 0-1 range for visualization
    // Raw normal would be: normalize(vec3(-dzdx, -dzdy, 1.0))
    // Remapped: normal * 0.5 + 0.5
    vec3 normal = normalize(vec3(-dzdx, -dzdy, 1.0));
    return normal * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalFromDepth_calc(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn normalFromDepth_calc(uv: vec2<f32>, radius: f32) -> vec3<f32> {
    // Sample depth at center and 4 neighboring points
    let depthCenter = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv));
    let depthLeft   = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv + vec2<f32>(-radius, 0.0)));
    let depthRight  = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv + vec2<f32>( radius, 0.0)));
    let depthUp     = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv + vec2<f32>(0.0,  radius)));
    let depthDown   = c3_linearizeDepth(textureSample(textureDepth, samplerDepth, uv + vec2<f32>(0.0, -radius)));
    
    // Calculate gradients using central differences
    let dzdx = (depthRight - depthLeft) / (2.0 * radius);
    let dzdy = (depthUp - depthDown) / (2.0 * radius);
    
    // Construct normal from gradients and remap to 0-1 range for visualization
    // Raw normal would be: normalize(vec3(-dzdx, -dzdy, 1.0))
    // Remapped: normal * 0.5 + 0.5
    let normal = normalize(vec3<f32>(-dzdx, -dzdy, 1.0));
    return normal * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = normalFromDepth_calc(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Texture",
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
    "Reconstructs surface normals from a depth buffer using central differences. Samples the depth at 4 neighboring points around the UV to calculate the surface gradient. Output is remapped to 0-1 range for visualization.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> The radius controls the sampling distance. Smaller values give more detail but may be noisier. Larger values give smoother results but may miss fine details.
    </div>
    <div class="tip">
      <strong>Note:</strong> The output normal is remapped from [-1,1] to [0,1] range. A flat surface facing the camera will be (0.5, 0.5, 1.0) - light blue.
    </div>
  `,
};
