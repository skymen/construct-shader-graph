import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const SrcOriginToNormNode = new NodeType(
  "srcOriginToNorm",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Normalized", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - srcOriginStart) / (srcOriginEnd - srcOriginStart);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - srcOriginStart) / (srcOriginEnd - srcOriginStart);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_srcOriginToNorm(${inputs[0]});`,
    },
  },
  "Builtin",
  ["source", "origin", "normalized", "coordinates", "uv"]
);
