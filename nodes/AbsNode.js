import { NodeType } from "./NodeType.js";

export const AbsNode = new NodeType(
  "Abs",
  [{ name: "Value", type: "float" }],
  [{ name: "Result", type: "float" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = abs(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = abs(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = abs(${inputs[0]});`,
    },
  }
);
