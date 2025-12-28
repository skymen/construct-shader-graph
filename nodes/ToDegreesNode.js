import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const ToDegreesNode = new NodeType(
  "To Degrees",
  [{ name: "Radians", type: "genType" }],
  [{ name: "Degrees", type: "genType" }],
  NODE_COLORS.trigonometry,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = degrees(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = degrees(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = degrees(${inputs[0]});`;
      },
    },
  },
  "Trigonometry",
  ["degrees", "radians", "convert", "conversion", "angle"]
);
