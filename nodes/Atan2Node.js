import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const Atan2Node = new NodeType(
  "Atan2",
  [
    { name: "Y", type: "genType" },
    { name: "X", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = atan(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = atan(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = atan2(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Trigonometry",
  ["arctangent", "inverse tangent", "arctan", "angle", "trig"]
);
