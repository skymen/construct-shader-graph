import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

export const SqrtNode = new NodeType(
  "Sqrt",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sqrt(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sqrt(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = sqrt(${inputs[0]});`;
      },
    },
  },
  "Math",
  ["square root", "root", "radical"]
);
