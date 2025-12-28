import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BitwiseNotNode = new NodeType(
  "Bitwise NOT",
  [{ name: "Value", type: "int" }],
  [{ name: "Result", type: "int" }],
  NODE_COLORS.utility,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    int ${outputs[0]} = ~${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    int ${outputs[0]} = ~${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: i32 = ~${inputs[0]};`,
    },
  },
  "Bitwise",
  [
    "bitwise",
    "not",
    "~",
    "bit",
    "invert",
    "complement",
    "binary",
    "integer",
    "operation",
    "flip",
  ]
);
