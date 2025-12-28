import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const LineSDFNode = new NodeType(
  "Line SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Start", type: "vec2" },
    { name: "End", type: "vec2" },
    { name: "Thickness", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  NODE_COLORS.sdfShape,
  {
    webgl1: {
      dependency: `float sdLine(vec2 p, vec2 a, vec2 b, float th) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdLine(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `float sdLine(vec2 p, vec2 a, vec2 b, float th) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdLine(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn sdLine(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, th: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdLine(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "SDF",
  ["sdf", "line", "segment", "shape", "distance", "field"]
);
