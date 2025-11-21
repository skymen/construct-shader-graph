import { NodeType } from "./NodeType.js";

export const BulgeNode = new NodeType(
  "Bulge",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Amount", type: "float" },
  ],
  [{ name: "Result", type: "vec2" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec2 bulge(vec2 uv, vec2 center, float amount) {
    vec2 delta = uv - center;
    float dist = length(delta);
    float factor = 1.0 + amount * dist;
    return center + delta * factor;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = bulge(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `vec2 bulge(vec2 uv, vec2 center, float amount) {
    vec2 delta = uv - center;
    float dist = length(delta);
    float factor = 1.0 + amount * dist;
    return center + delta * factor;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = bulge(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn bulge(uv: vec2<f32>, center: vec2<f32>, amount: f32) -> vec2<f32> {
    let delta = uv - center;
    let dist = length(delta);
    let factor = 1.0 + amount * dist;
    return center + delta * factor;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = bulge(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "UV",
  ["bulge", "distortion", "lens", "magnify", "uv", "warp", "effect"]
);
