import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SrcToNormNode = new NodeType(
  "srcToNorm",
  [{ name: "UV", type: "vec2" }],
  [{ name: "N", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - srcStart) / (srcEnd - srcStart);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - srcStart) / (srcEnd - srcStart);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_srcToNorm(${inputs[0]});`,
    },
  },
  "Utility",
  ["source", "normalized", "coordinates", "uv", "convert"]
);
