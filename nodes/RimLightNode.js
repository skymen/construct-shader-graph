import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const RimLightNode = new NodeType(
  "Rim Light",
  [
    { name: "Normal", type: "vec3" },
    { name: "Rim Color", type: "vec3", defaultValue: [1.0, 1.0, 1.0] },
    { name: "Power", type: "float", defaultValue: 2.0 },
    { name: "Intensity", type: "float", defaultValue: 1.0 },
  ],
  [{ name: "Rim", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 rimLight_calc(vec3 normal, vec3 rimColor, float power, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    // Fresnel-like rim calculation
    float rim = 1.0 - max(dot(n, viewDir), 0.0);
    rim = pow(rim, power) * intensity;
    return rimColor * rim;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = rimLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `vec3 rimLight_calc(vec3 normal, vec3 rimColor, float power, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    // Fresnel-like rim calculation
    float rim = 1.0 - max(dot(n, viewDir), 0.0);
    rim = pow(rim, power) * intensity;
    return rimColor * rim;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = rimLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn rimLight_calc(normal: vec3<f32>, rimColor: vec3<f32>, power: f32, intensity: f32) -> vec3<f32> {
    // Unpack normal from 0-1 range to -1 to 1 range
    let n = normalize(normal * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    let viewDir = vec3<f32>(0.0, 0.0, 1.0);
    // Fresnel-like rim calculation
    var rim = 1.0 - max(dot(n, viewDir), 0.0);
    rim = pow(rim, power) * intensity;
    return rimColor * rim;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = rimLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Lighting",
  ["rim", "fresnel", "edge", "glow", "outline", "backlight", "silhouette"]
);

RimLightNode.manual = {
  description:
    "Creates a rim/fresnel lighting effect that highlights edges facing away from the camera. Great for glow effects, character highlights, and sci-fi aesthetics.",
  html: `
    <div class="tip">
      <strong>Power:</strong> Higher values create a tighter rim effect. Lower values spread the effect more.
    </div>
    <div class="tip">
      <strong>Usage:</strong> Add the rim light output to your base lighting for edge highlights.
    </div>
  `,
};
