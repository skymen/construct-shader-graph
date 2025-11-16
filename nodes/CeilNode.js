import { NodeType } from "./NodeType.js";

export const CeilNode = new NodeType(
  "Ceil",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = ceil(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = ceil(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = ceil(${inputs[0]});`,
    },
  },
  "Math",
  ["ceiling", "round up", "integer"]
);
