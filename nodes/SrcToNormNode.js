import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const SrcToNormNode = new NodeType(
  "srcToNorm",
  [{ name: "Position", type: "vec2" }],
  [{ name: "Normalized", type: "vec2" }],
  PORT_TYPES.vec2.color,
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
