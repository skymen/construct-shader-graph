import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const IdentityMatrixNode = new NodeType(
  "Identity Matrix",
  [],
  [{ name: "Matrix", type: "genMatType" }],
  PORT_TYPES.mat3.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const matType = node.operation || "mat3";
        if (matType === "mat2") {
          return `    mat2 ${outputs[0]} = mat2(1.0, 0.0, 0.0, 1.0);`;
        } else if (matType === "mat3") {
          return `    mat3 ${outputs[0]} = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);`;
        } else {
          return `    mat4 ${outputs[0]} = mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const matType = node.operation || "mat3";
        if (matType === "mat2") {
          return `    mat2 ${outputs[0]} = mat2(1.0, 0.0, 0.0, 1.0);`;
        } else if (matType === "mat3") {
          return `    mat3 ${outputs[0]} = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);`;
        } else {
          return `    mat4 ${outputs[0]} = mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const matType = node.operation || "mat3";
        const wgslType = toWGSLType(matType);
        if (matType === "mat2") {
          return `    var ${outputs[0]}: ${wgslType} = ${wgslType}(1.0, 0.0, 0.0, 1.0);`;
        } else if (matType === "mat3") {
          return `    var ${outputs[0]}: ${wgslType} = ${wgslType}(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);`;
        } else {
          return `    var ${outputs[0]}: ${wgslType} = ${wgslType}(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);`;
        }
      },
    },
  },
  "Matrix",
  ["identity", "matrix", "unit", "diagonal", "mat2", "mat3", "mat4"]
);

IdentityMatrixNode.hasOperation = true;
IdentityMatrixNode.operationOptions = [
  { value: "mat2", label: "Mat2" },
  { value: "mat3", label: "Mat3" },
  { value: "mat4", label: "Mat4" },
];
IdentityMatrixNode.defaultOperation = "mat3";

// Resolve output type based on operation
IdentityMatrixNode.resolveOutputType = (node, outputIndex) => {
  return node.operation || "mat3";
};
