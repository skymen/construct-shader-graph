import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const TanNode = new NodeType(
  "Tan",
  [{ name: "Angle", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.trigonometry,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = tan(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = tan(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = tan(${inputs[0]});`;
      },
    },
  },
  "Trigonometry",
  ["tangent", "trig"]
);
