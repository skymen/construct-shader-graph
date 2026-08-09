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

// Scalars only. Folding vectors would mean reimplementing GLSL's mixed
// scalar/vector operand rules component-wise, which is a lot of surface area for
// no caller today - and declining just means the shader compiler folds it
// instead, which it does perfectly well everywhere except constant-expression
// positions.
MathNode.foldConstant = (node, inputs, { outputType: type }) => {
  if (type !== "int" && type !== "float") return null;

  const a = Number(inputs[0].value);
  const b = Number(inputs[1].value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  switch (node.operation || "+") {
    case "+":
      return type === "int" ? Math.trunc(a + b) : a + b;
    case "-":
      return type === "int" ? Math.trunc(a - b) : a - b;
    case "*":
      return type === "int" ? Math.trunc(a * b) : a * b;
    case "/":
      // Division by zero is undefined in GLSL, so leave it to the runtime
      // rather than folding to Infinity or NaN.
      if (b === 0) return null;
      // GLSL integer division truncates toward zero; JS division does not.
      return type === "int" ? Math.trunc(a / b) : a / b;
    default:
      return null;
  }
};
