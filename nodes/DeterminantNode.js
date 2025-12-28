import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const DeterminantNode = new NodeType(
  "Determinant",
  [{ name: "Matrix", type: "genMatType" }],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.colorMat3,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        // WebGL1 doesn't have determinant, need manual implementation
        const matType = inputTypes[0];
        if (matType === "mat2") {
          return `    float ${outputs[0]} = ${inputs[0]}[0][0] * ${inputs[0]}[1][1] - ${inputs[0]}[0][1] * ${inputs[0]}[1][0];`;
        } else if (matType === "mat3") {
          return `    float ${outputs[0]} = ${inputs[0]}[0][0] * (${inputs[0]}[1][1] * ${inputs[0]}[2][2] - ${inputs[0]}[2][1] * ${inputs[0]}[1][2])
        - ${inputs[0]}[1][0] * (${inputs[0]}[0][1] * ${inputs[0]}[2][2] - ${inputs[0]}[2][1] * ${inputs[0]}[0][2])
        + ${inputs[0]}[2][0] * (${inputs[0]}[0][1] * ${inputs[0]}[1][2] - ${inputs[0]}[1][1] * ${inputs[0]}[0][2]);`;
        } else {
          // mat4 determinant - using cofactor expansion
          return `    float ${outputs[0]} = ${inputs[0]}[0][0] * (
          ${inputs[0]}[1][1] * (${inputs[0]}[2][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[2][3]) -
          ${inputs[0]}[2][1] * (${inputs[0]}[1][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[1][3]) +
          ${inputs[0]}[3][1] * (${inputs[0]}[1][2] * ${inputs[0]}[2][3] - ${inputs[0]}[2][2] * ${inputs[0]}[1][3])
        ) - ${inputs[0]}[1][0] * (
          ${inputs[0]}[0][1] * (${inputs[0]}[2][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[2][3]) -
          ${inputs[0]}[2][1] * (${inputs[0]}[0][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[0][3]) +
          ${inputs[0]}[3][1] * (${inputs[0]}[0][2] * ${inputs[0]}[2][3] - ${inputs[0]}[2][2] * ${inputs[0]}[0][3])
        ) + ${inputs[0]}[2][0] * (
          ${inputs[0]}[0][1] * (${inputs[0]}[1][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[1][3]) -
          ${inputs[0]}[1][1] * (${inputs[0]}[0][2] * ${inputs[0]}[3][3] - ${inputs[0]}[3][2] * ${inputs[0]}[0][3]) +
          ${inputs[0]}[3][1] * (${inputs[0]}[0][2] * ${inputs[0]}[1][3] - ${inputs[0]}[1][2] * ${inputs[0]}[0][3])
        ) - ${inputs[0]}[3][0] * (
          ${inputs[0]}[0][1] * (${inputs[0]}[1][2] * ${inputs[0]}[2][3] - ${inputs[0]}[2][2] * ${inputs[0]}[1][3]) -
          ${inputs[0]}[1][1] * (${inputs[0]}[0][2] * ${inputs[0]}[2][3] - ${inputs[0]}[2][2] * ${inputs[0]}[0][3]) +
          ${inputs[0]}[2][1] * (${inputs[0]}[0][2] * ${inputs[0]}[1][3] - ${inputs[0]}[1][2] * ${inputs[0]}[0][3])
        );`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = determinant(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = determinant(${inputs[0]});`,
    },
  },
  "Matrix",
  ["determinant", "matrix", "det", "volume", "scale"]
);
