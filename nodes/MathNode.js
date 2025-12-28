import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

export const MathNode = new NodeType(
  "Math",
  [
    { name: "A", type: "genType" },
    { name: "B", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "+";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "+";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "+";
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} ${op} ${inputs[1]};`;
      },
    },
  },
  "Math",
  [
    "add",
    "subtract",
    "multiply",
    "divide",
    "arithmetic",
    "operation",
    "+",
    "-",
    "*",
    "/",
  ],
  { operations: true } // Don't translate mathematical symbols
);

// Add operation options to the node type
MathNode.hasOperation = true;
MathNode.operationOptions = [
  { value: "+", label: "+" },
  { value: "-", label: "−" },
  { value: "*", label: "×" },
  { value: "/", label: "÷" },
];
