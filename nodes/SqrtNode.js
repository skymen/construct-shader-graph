import { NodeType } from "./NodeType.js";

export const SqrtNode = new NodeType(
  "Sqrt",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = sqrt(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = sqrt(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = sqrt(${inputs[0]});`,
    },
  },
  "Math",
  ["square root", "root", "radical"]
);
