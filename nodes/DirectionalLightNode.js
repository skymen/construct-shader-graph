import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const DirectionalLightNode = new NodeType(
  "Directional Light",
  [
    { name: "Normal", type: "vec3" },
    { name: "Light Dir", type: "vec3", defaultValue: [0.5, 0.5, 1.0] },
    { name: "Light Color", type: "vec3", defaultValue: [1.0, 1.0, 1.0] },
    { name: "Intensity", type: "float", defaultValue: 1.0 },
  ],
  [{ name: "Light", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 directionalLight_calc(vec3 normal, vec3 lightDir, vec3 lightColor, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction
    vec3 l = normalize(lightDir * 2.0 - 1.0);
    // N dot L diffuse lighting
    float ndotl = max(dot(n, l), 0.0);
    return lightColor * ndotl * intensity;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = directionalLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `vec3 directionalLight_calc(vec3 normal, vec3 lightDir, vec3 lightColor, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction
    vec3 l = normalize(lightDir * 2.0 - 1.0);
    // N dot L diffuse lighting
    float ndotl = max(dot(n, l), 0.0);
    return lightColor * ndotl * intensity;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = directionalLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn directionalLight_calc(normal: vec3<f32>, lightDir: vec3<f32>, lightColor: vec3<f32>, intensity: f32) -> vec3<f32> {
    // Unpack normal from 0-1 range to -1 to 1 range
    let n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction
    let l = normalize(lightDir * 2.0 - 1.0);
    // N dot L diffuse lighting
    let ndotl = max(dot(n, l), 0.0);
    return lightColor * ndotl * intensity;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = directionalLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Lighting",
  [
    "light",
    "directional",
    "sun",
    "diffuse",
    "lambert",
    "shading",
    "illumination",
  ]
);

DirectionalLightNode.manual = {
  description:
    "Calculates diffuse lighting using the Lambertian model (N·L). Takes a normal and light direction to compute how much light hits the surface.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> The Light Direction uses 0-1 range like normals. (0.5, 0.5, 1.0) points towards the camera, (1.0, 0.5, 0.5) points right.
    </div>
    <div class="tip">
      <strong>Usage:</strong> Connect the Normal From Depth output directly to this node's Normal input.
    </div>
  `,
};
