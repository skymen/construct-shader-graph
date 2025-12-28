import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Hash33Node = new NodeType(
  "Hash 3→3",
  [{ name: "Seed", type: "vec3" }],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.hash,
  {
    webgl1: {
      dependency: `vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hash33(${inputs[0]});`,
    },
    webgl2: {
      dependency: `vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hash33(${inputs[0]});`,
    },
    webgpu: {
      dependency: `fn hash33(p3_in: vec3<f32>) -> vec3<f32> {
    var p3 = fract(p3_in * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = hash33(${inputs[0]});`,
    },
  },
  "Noise",
  ["hash", "random", "pseudo-random", "prng", "noise"]
);
