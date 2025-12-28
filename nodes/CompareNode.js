import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

export const CompareNode = new NodeType(
  "Compare",
  [
    { name: "A", type: "genType" },
    { name: "B", type: "genType" },
  ],
  [{ name: "Result", type: "bool" }],
  NODE_COLORS.comparison,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || ">";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || ">";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || ">";
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
  },
  "Logic",
  [
    "comparison",
    "conditional",
    "test",
    "equal",
    "greater",
    "less",
    "smaller",
    "larger",
  ],
  { operations: true } // Don't translate comparison symbols
);

// Add operation options to the node type
CompareNode.hasOperation = true;
CompareNode.operationOptions = [
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "==", label: "=" },
  { value: "!=", label: "≠" },
  { value: "<=", label: "≤" },
  { value: "<", label: "<" },
];
