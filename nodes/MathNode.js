import { NodeType } from "./NodeType.js";

export const MathNode = new NodeType(
  "Math",
  [
    { name: "A", type: "float" },
    { name: "B", type: "float" },
  ],
  [{ name: "Result", type: "float" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} + ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} + ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]} + ${inputs[1]};`,
    },
  }
);
