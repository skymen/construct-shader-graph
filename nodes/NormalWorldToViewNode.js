import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const NormalWorldToViewNode = new NodeType(
  "Normal World To View",
  [
    { name: "Normal", type: "vec3" },
    { name: "Camera Forward", type: "vec3", defaultValue: [0.5, 0.5, 0.0] },
    { name: "Camera Up", type: "vec3", defaultValue: [0.5, 1.0, 0.5] },
  ],
  [{ name: "View", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 normalWorldToView_calc(vec3 normal, vec3 camForward, vec3 camUp) {
    // Unpack normal from 0-1 to -1,1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Unpack camera vectors from 0-1 to -1,1 range
    vec3 forward = normalize(camForward * 2.0 - 1.0);
    vec3 up = normalize(camUp * 2.0 - 1.0);
    // Build view-to-world matrix from camera basis
    vec3 right = normalize(cross(up, forward));
    up = normalize(cross(forward, right));
    // Transform normal from world space to view space (inverse = transpose for orthonormal basis)
    vec3 viewNormal = vec3(dot(n, right), dot(n, up), dot(n, forward));
    // Pack back to 0-1 range
    return normalize(viewNormal) * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalWorldToView_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `vec3 normalWorldToView_calc(vec3 normal, vec3 camForward, vec3 camUp) {
    // Unpack normal from 0-1 to -1,1 range
    vec3 n = normalize(normal * 2.0 - 1.0);
    // Unpack camera vectors from 0-1 to -1,1 range
    vec3 forward = normalize(camForward * 2.0 - 1.0);
    vec3 up = normalize(camUp * 2.0 - 1.0);
    // Build view-to-world matrix from camera basis
    vec3 right = normalize(cross(up, forward));
    up = normalize(cross(forward, right));
    // Transform normal from world space to view space (inverse = transpose for orthonormal basis)
    vec3 viewNormal = vec3(dot(n, right), dot(n, up), dot(n, forward));
    // Pack back to 0-1 range
    return normalize(viewNormal) * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = normalWorldToView_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn normalWorldToView_calc(normal: vec3<f32>, camForward: vec3<f32>, camUp: vec3<f32>) -> vec3<f32> {
    // Unpack normal from 0-1 to -1,1 range
    let n = normalize(normal * 2.0 - 1.0);
    // Unpack camera vectors from 0-1 to -1,1 range
    let forward = normalize(camForward * 2.0 - 1.0);
    var up = normalize(camUp * 2.0 - 1.0);
    // Build view-to-world matrix from camera basis
    let right = normalize(cross(up, forward));
    up = normalize(cross(forward, right));
    // Transform normal from world space to view space (inverse = transpose for orthonormal basis)
    let viewNormal = vec3<f32>(dot(n, right), dot(n, up), dot(n, forward));
    // Pack back to 0-1 range
    return normalize(viewNormal) * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = normalWorldToView_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "Lighting",
  ["normal", "world", "view", "transform", "camera", "space", "convert"]
);

NormalWorldToViewNode.manual = {
  description:
    "Transforms a normal from world space to view/screen space using the camera's forward and up vectors.",
  html: `
    <div class="tip">
      <strong>Inputs:</strong> All vectors use 0-1 range. Camera Forward (0.5, 0.5, 0.0) = looking at -Z, Camera Up (0.5, 1.0, 0.5) = Y up.
    </div>
    <div class="tip">
      <strong>Usage:</strong> Use this to convert world-space normal maps to view space for screen-space effects.
    </div>
  `,
};
