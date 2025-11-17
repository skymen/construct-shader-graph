import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BooleanNotNode = new NodeType(
  "Boolean NOT",
  [{ name: "Value", type: "bool" }],
  [{ name: "Result", type: "bool" }],
  PORT_TYPES.bool.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    bool ${outputs[0]} = !${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    bool ${outputs[0]} = !${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: bool = !${inputs[0]};`,
    },
  },
  "Logic",
  [
    "boolean",
    "not",
    "!",
    "logic",
    "logical",
    "invert",
    "negate",
    "bool",
    "operation",
    "gate",
  ]
);
