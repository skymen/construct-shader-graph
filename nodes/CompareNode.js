import { NodeType } from "./NodeType.js";

export const CompareNode = new NodeType(
  "Compare",
  [
    { name: "A", type: "genType" },
    { name: "B", type: "genType" },
  ],
  [{ name: "Result", type: "boolean" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || ">";
        return `    bool ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || ">";
        return `    bool ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || ">";
        return `    var ${outputs[0]}: bool = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
  }
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
