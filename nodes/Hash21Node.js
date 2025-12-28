import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Hash21Node = new NodeType(
  "Hash 2→1",
  [{ name: "Seed", type: "vec2" }],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.hash,
  {
    webgl1: {
      dependency: `float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = hash21(${inputs[0]});`,
    },
    webgl2: {
      dependency: `float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = hash21(${inputs[0]});`,
    },
    webgpu: {
      dependency: `fn hash21(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = hash21(${inputs[0]});`,
    },
  },
  "Noise",
  ["hash", "random", "pseudo-random", "prng", "noise"]
);
