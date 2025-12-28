import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const SelectNode = new NodeType(
  "Select",
  [
    { name: "Condition", type: "bool" },
    { name: "True", type: "T" },
    { name: "False", type: "T" },
  ],
  [{ name: "Result", type: "T" }],
  NODE_COLORS.comparison,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ? ${inputs[1]} : ${inputs[2]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} ? ${inputs[1]} : ${inputs[2]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    var ${outputs[0]}: ${toWGSLType(outputTypes[0])} = select(${
          inputs[2]
        }, ${inputs[1]}, ${inputs[0]});`,
    },
  },
  "Logic",
  ["conditional", "ternary", "if", "choose", "branch"]
);
