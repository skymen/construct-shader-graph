import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BoolInputNode = new NodeType(
  "Bool Input",
  [], // No inputs
  [{ name: "Value", type: "bool" }],
  PORT_TYPES.bool.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.operation || "false";
        return `    bool ${outputs[0]} = ${value};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.operation || "false";
        return `    bool ${outputs[0]} = ${value};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.operation || "false";
        return `    var ${outputs[0]}: bool = ${value};`;
      },
    },
  },
  "Value",
  ["bool", "boolean", "true", "false", "constant", "value", "input", "literal"]
);

// Add operation options for true/false selection
BoolInputNode.hasOperation = true;
BoolInputNode.operationOptions = [
  { value: "false", label: "False" },
  { value: "true", label: "True" },
];
