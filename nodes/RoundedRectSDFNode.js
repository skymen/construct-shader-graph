import { NodeType } from "./NodeType.js";

export const RoundedRectSDFNode = new NodeType(
  "Rounded Rect SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Size", type: "vec2" },
    { name: "Radius", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdRoundedRect(vec2 p, vec2 center, vec2 size, float r) {
    vec2 d = abs(p - center) - size * 0.5 + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdRoundedRect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `float sdRoundedRect(vec2 p, vec2 center, vec2 size, float r) {
    vec2 d = abs(p - center) - size * 0.5 + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdRoundedRect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn sdRoundedRect(p: vec2<f32>, center: vec2<f32>, size: vec2<f32>, r: f32) -> f32 {
    let d = abs(p - center) - size * 0.5 + r;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0) - r;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdRoundedRect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "SDF",
  ["sdf", "rounded", "rectangle", "box", "corner", "shape", "distance", "field"]
);
