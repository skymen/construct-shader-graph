import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ClampToDestNode = new NodeType(
  "clampToDest",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Clamped", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]}, destStart, destEnd);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]}, destStart, destEnd);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_clampToDest(${inputs[0]});`,
    },
  },
  "Utility",
  ["clamp", "destination", "coordinates", "uv", "bounds"]
);
