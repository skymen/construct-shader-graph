import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const SelectNode = new NodeType(
  "Select",
  [
    { name: "Condition", type: "boolean" },
    { name: "True", type: "T" },
    { name: "False", type: "T" },
  ],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = ${inputs[0]} ? ${inputs[1]} : ${inputs[2]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = ${inputs[0]} ? ${inputs[1]} : ${inputs[2]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = select(${inputs[2]}, ${inputs[1]}, ${inputs[0]});`,
    },
  },
  "Logic",
  ["conditional", "ternary", "if", "choose", "branch"]
);
