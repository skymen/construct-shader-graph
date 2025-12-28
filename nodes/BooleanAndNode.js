import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BooleanAndNode = new NodeType(
  "Boolean AND",
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
        `    bool ${outputs[0]} = ${inputs[0]} && ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = ${inputs[0]} && ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: bool = ${inputs[0]} && ${inputs[1]};`,
    },
  },
  "Logic",
  ["boolean", "and", "&&", "logic", "logical", "bool", "operation", "gate"]
);
