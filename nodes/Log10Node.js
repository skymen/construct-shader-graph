import { NodeType } from "./NodeType.js";

export const Log10Node = new NodeType(
  "Log10",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = log(${inputs[0]}) / log(10.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = log(${inputs[0]}) / log(10.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = log(${inputs[0]}) / log(10.0);`,
    },
  },
  "Math",
  ["logarithm", "log", "base 10", "common log"]
);
