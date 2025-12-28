import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const GetBitNode = new NodeType(
  "Get Bit",
  [
    { name: "Value", type: "int" },
    { name: "Index", type: "int" },
  ],
  [{ name: "Bit", type: "bool" }],
  NODE_COLORS.colorInt,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = ((${inputs[0]} >> ${inputs[1]}) & 1) == 1;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = ((${inputs[0]} >> ${inputs[1]}) & 1) == 1;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: bool = ((${inputs[0]} >> ${inputs[1]}) & 1) == 1;`,
    },
  },
  "Bitwise",
  [
    "bit",
    "get",
    "mask",
    "bitwise",
    "index",
    "flag",
    "test",
    "binary",
    "integer",
    "operation",
    "read",
    "check",
  ]
);
