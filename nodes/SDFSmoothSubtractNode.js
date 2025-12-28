import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFSmoothSubtractNode = new NodeType(
  "SDF Smooth Subtract",
  [
    { name: "A", type: "float" },
    { name: "B", type: "float" },
    { name: "Smoothness", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  NODE_COLORS.sdfOperation,
  {
    webgl1: {
      dependency: `float sdSmoothSubtract(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdSmoothSubtract(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `float sdSmoothSubtract(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdSmoothSubtract(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn sdSmoothSubtract(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 + d1) / max(k, 0.0001), 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdSmoothSubtract(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "SDF",
  [
    "sdf",
    "smooth",
    "subtract",
    "difference",
    "blend",
    "cut",
    "boolean",
    "operation",
  ]
);
