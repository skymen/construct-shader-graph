import { NodeType } from "./NodeType.js";

export const VectorNode = new NodeType(
  "Vector",
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
    { name: "Z", type: "float" },
  ],
  [{ name: "Vector", type: "vector" }],
  "#4a3a3a",
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
