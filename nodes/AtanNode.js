import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const AtanNode = new NodeType(
  "Atan",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = atan(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = atan(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = atan(${inputs[0]});`,
    },
  },
  "Trigonometry",
  ["arctangent", "inverse tangent", "arctan", "trig"]
);
