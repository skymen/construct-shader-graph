import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const MultiplyVectorNode = new NodeType(
  "Multiply Vector",
  [
    { name: "Vector", type: "genType" },
    { name: "Scalar", type: "float" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} * ${inputs[1]};`;
      },
    },
  },
  "Vector",
  ["multiply", "scale", "scalar", "vector", "multiply vector", "scale vector"]
);
