import { NodeType } from "./NodeType.js";

export const CapsuleSDFNode = new NodeType(
  "Capsule SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Start", type: "vec2" },
    { name: "End", type: "vec2" },
    { name: "Radius", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdCapsule(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdCapsule(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn sdCapsule(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdCapsule(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "SDF",
  ["sdf", "capsule", "pill", "stadium", "shape", "distance", "field", "rounded"]
);
