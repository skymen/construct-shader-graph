import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const TransposeNode = new NodeType(
  "Transpose",
  [{ name: "Matrix", type: "genMatType" }],
  [{ name: "Result", type: "genMatType" }],
  NODE_COLORS.colorMat3,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        // WebGL1 doesn't have transpose, need manual implementation
        const matType = inputTypes[0];
        if (matType === "mat2") {
          return `    mat2 ${outputs[0]} = mat2(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[0][1], ${inputs[0]}[1][1]);`;
        } else if (matType === "mat3") {
          return `    mat3 ${outputs[0]} = mat3(
        ${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0],
        ${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1],
        ${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2]);`;
        } else {
          return `    mat4 ${outputs[0]} = mat4(
        ${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0], ${inputs[0]}[3][0],
        ${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1], ${inputs[0]}[3][1],
        ${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2], ${inputs[0]}[3][2],
        ${inputs[0]}[0][3], ${inputs[0]}[1][3], ${inputs[0]}[2][3], ${inputs[0]}[3][3]);`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = transpose(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = transpose(${inputs[0]});`;
      },
    },
  },
  "Matrix",
  ["transpose", "matrix", "flip", "swap", "rows", "columns"]
);
