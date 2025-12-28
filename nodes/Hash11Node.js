import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Hash11Node = new NodeType(
  "Hash 1→1",
  [{ name: "Seed", type: "float" }],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.hash,
  {
    webgl1: {
      dependency: `float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = hash11(${inputs[0]});`,
    },
    webgl2: {
      dependency: `float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = hash11(${inputs[0]});`,
    },
    webgpu: {
      dependency: `fn hash11(p: f32) -> f32 {
    var p_var = fract(p * 0.1031);
    p_var *= p_var + 33.33;
    p_var *= p_var + p_var;
    return fract(p_var);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = hash11(${inputs[0]});`,
    },
  },
  "Noise",
  ["hash", "random", "pseudo-random", "prng", "noise", "float"]
);
