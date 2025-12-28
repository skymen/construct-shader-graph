import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ClampToSrcNode = new NodeType(
  "clampToSrc",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Clamped", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]}, srcStart, srcEnd);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]}, srcStart, srcEnd);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_clampToSrc(${inputs[0]});`,
    },
  },
  "Utility",
  ["clamp", "source", "coordinates", "uv", "bounds"]
);
