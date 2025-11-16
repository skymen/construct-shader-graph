import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ToDegreesNode = new NodeType(
  "To Degrees",
  [{ name: "Radians", type: "genType" }],
  [{ name: "Degrees", type: "genType" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = degrees(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = degrees(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = degrees(${inputs[0]});`,
    },
  },
  "Trigonometry",
  ["degrees", "radians", "convert", "conversion", "angle"]
);
