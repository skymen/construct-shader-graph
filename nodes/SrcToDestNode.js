import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const SrcToDestNode = new NodeType(
  "srcToDest",
  [{ name: "Position", type: "vec2" }],
  [{ name: "Dest", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => {
        const normalized = `((${inputs[0]} - srcStart) / (srcEnd - srcStart))`;
        return `    vec2 ${outputs[0]} = mix(destStart, destEnd, ${normalized});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => {
        const normalized = `((${inputs[0]} - srcStart) / (srcEnd - srcStart))`;
        return `    vec2 ${outputs[0]} = mix(destStart, destEnd, ${normalized});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_srcToDest(${inputs[0]});`,
    },
  },
  "Utility",
  ["source", "destination", "coordinates", "uv", "convert", "map"]
);
