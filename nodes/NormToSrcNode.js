import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const NormToSrcNode = new NodeType(
  "normToSrc",
  [{ name: "Normalized", type: "vec2" }],
  [{ name: "Position", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcStart, srcEnd, ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcStart, srcEnd, ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_normToSrc(${inputs[0]});`,
    },
  },
  "Utility",
  ["normalized", "source", "coordinates", "uv", "convert"]
);
