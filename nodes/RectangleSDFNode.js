import { NodeType } from "./NodeType.js";

export const RectangleSDFNode = new NodeType(
  "Rectangle SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Size", type: "vec2" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdRectangle(vec2 p, vec2 center, vec2 size) {
    vec2 d = abs(p - center) - size * 0.5;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdRectangle(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `float sdRectangle(vec2 p, vec2 center, vec2 size) {
    vec2 d = abs(p - center) - size * 0.5;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdRectangle(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn sdRectangle(p: vec2<f32>, center: vec2<f32>, size: vec2<f32>) -> f32 {
    let d = abs(p - center) - size * 0.5;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdRectangle(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "SDF",
  ["sdf", "rectangle", "box", "square", "shape", "distance", "field"]
);
