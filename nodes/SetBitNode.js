import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SetBitNode = new NodeType(
  "Set Bit",
  [
    { name: "Value", type: "int" },
    { name: "Index", type: "int" },
    { name: "Bit", type: "bool" },
  ],
  [{ name: "Result", type: "int" }],
  NODE_COLORS.colorInt,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    int ${outputs[0]} = ${inputs[2]} ? (${inputs[0]} | (1 << ${inputs[1]})) : (${inputs[0]} & ~(1 << ${inputs[1]}));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    int ${outputs[0]} = ${inputs[2]} ? (${inputs[0]} | (1 << ${inputs[1]})) : (${inputs[0]} & ~(1 << ${inputs[1]}));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: i32 = select(${inputs[0]} & ~(1 << ${inputs[1]}), ${inputs[0]} | (1 << ${inputs[1]}), ${inputs[2]});`,
    },
  },
  "Bitwise",
  [
    "bit",
    "set",
    "mask",
    "bitwise",
    "index",
    "flag",
    "binary",
    "integer",
    "operation",
    "write",
    "modify",
  ]
);
