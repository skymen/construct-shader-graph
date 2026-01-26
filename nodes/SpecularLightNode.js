import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SpecularLightNode = new NodeType(
  "Specular Light",
  [
    { name: "Normal", type: "vec3" },
    { name: "Light Dir", type: "vec3", defaultValue: [0.5, 0.5, 1.0] },
    { name: "Specular Color", type: "vec3", defaultValue: [1.0, 1.0, 1.0] },
    { name: "Shininess", type: "float", defaultValue: 32.0 },
    { name: "Intensity", type: "float", defaultValue: 1.0 },
  ],
  [{ name: "Specular", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 specularLight_calc(vec3 normal, vec3 lightDir, vec3 specColor, float shininess, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction (also in 0-1 range)
    vec3 l = normalize(lightDir * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    // Blinn-Phong half vector
    vec3 halfVec = normalize(l + viewDir);
    // Specular calculation
    float spec = pow(max(dot(n, halfVec), 0.0), shininess);
    return specColor * spec * intensity;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = specularLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgl2: {
      dependency: `vec3 specularLight_calc(vec3 normal, vec3 lightDir, vec3 specColor, float shininess, float intensity) {
    // Unpack normal from 0-1 range to -1 to 1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction (also in 0-1 range)
    vec3 l = normalize(lightDir * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    // Blinn-Phong half vector
    vec3 halfVec = normalize(l + viewDir);
    // Specular calculation
    float spec = pow(max(dot(n, halfVec), 0.0), shininess);
    return specColor * spec * intensity;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = specularLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgpu: {
      dependency: `fn specularLight_calc(normal: vec3<f32>, lightDir: vec3<f32>, specColor: vec3<f32>, shininess: f32, intensity: f32) -> vec3<f32> {
    // Unpack normal from 0-1 range to -1 to 1 range
    let n = normalize(normal * 2.0 - 1.0);
    // Normalize light direction (also in 0-1 range)
    let l = normalize(lightDir * 2.0 - 1.0);
    // View direction is towards camera (0, 0, 1) in view space
    let viewDir = vec3<f32>(0.0, 0.0, 1.0);
    // Blinn-Phong half vector
    let halfVec = normalize(l + viewDir);
    // Specular calculation
    let spec = pow(max(dot(n, halfVec), 0.0), shininess);
    return specColor * spec * intensity;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = specularLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
  },
  "Lighting",
  ["specular", "highlight", "shine", "blinn", "phong", "glossy", "reflection"]
);

SpecularLightNode.manual = {
  description:
    "Calculates specular highlights using the Blinn-Phong model. Creates shiny reflections on surfaces based on the light and view directions.",
  html: `
    <div class="tip">
      <strong>Shininess:</strong> Higher values (64-256) create tight, sharp highlights. Lower values (8-32) create broader, softer highlights.
    </div>
    <div class="tip">
      <strong>Usage:</strong> Add specular to your diffuse lighting for shiny materials like plastic, metal, or wet surfaces.
    </div>
  `,
};
