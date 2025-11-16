import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const AsinNode = new NodeType(
  "Asin",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = asin(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = asin(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = asin(${inputs[0]});`,
    },
  },
  "Trigonometry",
  ["arcsine", "inverse sine", "arcsin", "trig"]
);
