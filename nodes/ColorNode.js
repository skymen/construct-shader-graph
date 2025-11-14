import { NodeType } from "./NodeType.js";

export const ColorNode = new NodeType(
  "Color",
  [
    { name: "R", type: "float" },
    { name: "G", type: "float" },
    { name: "B", type: "float" },
  ],
  [{ name: "Color", type: "color" }],
  "#3a3a4a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  }
);
