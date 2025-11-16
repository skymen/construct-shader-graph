import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ToRadiansNode = new NodeType(
  "To Radians",
  [{ name: "Degrees", type: "genType" }],
  [{ name: "Radians", type: "genType" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = radians(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = radians(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = radians(${inputs[0]});`,
    },
  },
  "Trigonometry",
  ["radians", "degrees", "convert", "conversion", "angle"]
);
