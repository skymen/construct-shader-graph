import { NodeType } from "./NodeType.js";

export const Exp10Node = new NodeType(
  "Exp10",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = pow(10.0, ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = pow(10.0, ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = pow(10.0, ${inputs[0]});`,
    },
  },
  "Math",
  ["exponential", "power of 10", "10^x", "decimal"]
);
