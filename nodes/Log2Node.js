import { NodeType } from "./NodeType.js";

export const Log2Node = new NodeType(
  "Log2",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = log2(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = log2(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = log2(${inputs[0]});`,
    },
  },
  "Math",
  ["logarithm", "log", "base 2", "binary log"]
);
