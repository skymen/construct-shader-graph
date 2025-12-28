import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import { toWGSLType } from "./PortTypes.js";

export const DDXNode = new NodeType(
  "DDX",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: `#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = dFdx(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = dFdx(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = dpdx(${inputs[0]});`;
      },
    },
  },
  "Math",
  ["derivative", "ddx", "dfdx", "gradient", "screen-space", "partial"]
);
