import { NodeType } from "./NodeType.js";

export const ToFloatNode = new NodeType(
  "To Float",
  [{ name: "Value", type: "int" }],
  [{ name: "Result", type: "float" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = float(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = float(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = f32(${inputs[0]});`,
    },
  },
  "Conversion",
  ["cast", "convert", "int to float", "type"]
);
