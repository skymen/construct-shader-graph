import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Hash22Node = new NodeType(
  "Hash 2→2",
  [{ name: "Seed", type: "vec2" }],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.hash,
  {
    webgl1: {
      dependency: `vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = hash22(${inputs[0]});`,
    },
    webgl2: {
      dependency: `vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = hash22(${inputs[0]});`,
    },
    webgpu: {
      dependency: `fn hash22(p: vec2<f32>) -> vec2<f32> {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = hash22(${inputs[0]});`,
    },
  },
  "Noise",
  ["hash", "random", "pseudo-random", "prng", "noise"]
);
