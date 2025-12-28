import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const NormToSrcNode = new NodeType(
  "normToSrc",
  [{ name: "N", type: "vec2" }],
  [{ name: "UV", type: "vec2" }],
  NODE_COLORS.coordConvert,
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
