import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

export const RemapNode = new NodeType(
  "Remap",
  [
    { name: "Value", type: "genType" },
    { name: "From Min", type: "genType" },
    { name: "From Max", type: "genType" },
    { name: "To Min", type: "genType" },
    { name: "To Max", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[3]} + (${inputs[0]} - ${inputs[1]}) * (${inputs[4]} - ${inputs[3]}) / (${inputs[2]} - ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[3]} + (${inputs[0]} - ${inputs[1]}) * (${inputs[4]} - ${inputs[3]}) / (${inputs[2]} - ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[3]} + (${inputs[0]} - ${inputs[1]}) * (${inputs[4]} - ${inputs[3]}) / (${inputs[2]} - ${inputs[1]});`;
      },
    },
  },
  "Math",
  ["remap", "map", "range", "scale", "normalize", "convert"]
);
