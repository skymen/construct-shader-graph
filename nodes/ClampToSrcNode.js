import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ClampToSrcNode = new NodeType(
  "clampToSrc",
  [{ name: "Position", type: "vec2" }],
  [{ name: "Clamped", type: "vec2" }],
  PORT_TYPES.vec2.color,
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
