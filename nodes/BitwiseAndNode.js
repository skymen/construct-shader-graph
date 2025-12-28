import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BitwiseAndNode = new NodeType(
  "Bitwise AND",
  [
    { name: "A", type: "int" },
    { name: "B", type: "int" },
  ],
  [{ name: "Result", type: "int" }],
  NODE_COLORS.utility,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    int ${outputs[0]} = ${inputs[0]} & ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    int ${outputs[0]} = ${inputs[0]} & ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: i32 = ${inputs[0]} & ${inputs[1]};`,
    },
  },
  "Bitwise",
  ["bitwise", "and", "&", "bit", "mask", "binary", "integer", "operation"]
);
