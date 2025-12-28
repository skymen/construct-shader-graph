import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const StepNode = new NodeType(
  "Step",
  [
    { name: "Edge", type: "genType" },
    { name: "Value", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = step(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = step(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = step(${inputs[0]}, ${inputs[1]});`;
      },
    },
  },
  "Math",
  ["threshold", "cutoff"]
);
