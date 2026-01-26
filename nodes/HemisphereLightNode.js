import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const HemisphereLightNode = new NodeType(
  "Hemisphere Light",
  [
    { name: "Normal", type: "vec3" },
    { name: "Sky Color", type: "vec3", defaultValue: [0.6, 0.8, 1.0] },
    { name: "Ground Color", type: "vec3", defaultValue: [0.3, 0.2, 0.1] },
  ],
  [{ name: "Ambient", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 hemisphereLight_calc(vec3 normal, vec3 skyColor, vec3 groundColor) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Blend between ground and sky based on normal Y component
    // Remap from -1,1 to 0,1
    float blend = n.y * 0.5 + 0.5;
    return mix(groundColor, skyColor, blend);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hemisphereLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `vec3 hemisphereLight_calc(vec3 normal, vec3 skyColor, vec3 groundColor) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Blend between ground and sky based on normal Y component
    // Remap from -1,1 to 0,1
    float blend = n.y * 0.5 + 0.5;
    return mix(groundColor, skyColor, blend);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hemisphereLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn hemisphereLight_calc(normal: vec3<f32>, skyColor: vec3<f32>, groundColor: vec3<f32>) -> vec3<f32> {
    // Unpack normal from 0-1 range to -1 to 1 range
    let n = normalize(normal * 2.0 - 1.0);
    // Blend between ground and sky based on normal Y component
    // Remap from -1,1 to 0,1
    let blend = n.y * 0.5 + 0.5;
    return mix(groundColor, skyColor, blend);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = hemisphereLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "Lighting",
  ["hemisphere", "ambient", "sky", "ground", "environment", "indirect"]
);

HemisphereLightNode.manual = {
  description:
    "Two-color ambient lighting that blends between sky and ground colors based on the surface normal direction. Simulates soft environmental lighting.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Use warm ground colors and cool sky colors for natural outdoor lighting.
    </div>
    <div class="tip">
      <strong>Usage:</strong> Add this to your directional light for more realistic ambient fill.
    </div>
  `,
};
