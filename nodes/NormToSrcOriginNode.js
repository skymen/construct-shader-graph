import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const NormToSrcOriginNode = new NodeType(
  "normToSrcOrigin",
  [{ name: "N", type: "vec2" }],
  [{ name: "UV", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_normToSrcOrigin(${inputs[0]});`,
    },
  },
  "Utility",
  ["normalized", "source", "origin", "coordinates", "uv", "convert"]
);
