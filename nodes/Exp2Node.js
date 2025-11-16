import { NodeType } from "./NodeType.js";

export const Exp2Node = new NodeType(
  "Exp2",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = exp2(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = exp2(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = exp2(${inputs[0]});`,
    },
  },
  "Math",
  ["exponential", "power of 2", "2^x", "binary"]
);
