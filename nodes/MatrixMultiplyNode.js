import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const MatrixMultiplyNode = new NodeType(
  "Matrix Multiply",
  [
    { name: "A", type: "genMatType" },
    { name: "B", type: "genMatType" },
  ],
  [{ name: "Result", type: "genMatType" }],
  PORT_TYPES.mat3.color,
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
  "Matrix",
  ["matrix", "multiply", "product", "concatenate", "combine", "transform"]
);
