import { NodeType } from "./NodeType.js";

export const SDFSmoothIntersectNode = new NodeType(
  "SDF Smooth Intersect",
  [
    { name: "A", type: "float" },
    { name: "B", type: "float" },
    { name: "Smoothness", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#4a6e2d",
  {
    webgl1: {
      dependency: `float sdSmoothIntersect(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdSmoothIntersect(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `float sdSmoothIntersect(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdSmoothIntersect(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn sdSmoothIntersect(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 - d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdSmoothIntersect(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "SDF",
  [
    "sdf",
    "smooth",
    "intersect",
    "intersection",
    "blend",
    "boolean",
    "operation",
  ]
);
