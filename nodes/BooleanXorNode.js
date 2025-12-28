import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BooleanXorNode = new NodeType(
  "Boolean XOR",
  [
    { name: "A", type: "bool" },
    { name: "B", type: "bool" },
  ],
  [{ name: "Result", type: "bool" }],
  NODE_COLORS.comparison,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = ${inputs[0]} != ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = ${inputs[0]} != ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: bool = ${inputs[0]} != ${inputs[1]};`,
    },
  },
  "Logic",
  [
    "boolean",
    "xor",
    "exclusive or",
    "logic",
    "logical",
    "bool",
    "operation",
    "gate",
    "toggle",
    "different",
  ]
);
