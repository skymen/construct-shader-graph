import { NodeType } from "./NodeType.js";

export const SDFSubtractNode = new NodeType(
  "SDF Subtract",
  [
    { name: "A", type: "float" },
    { name: "B", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#4a6e2d",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = max(${inputs[0]}, -${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = max(${inputs[0]}, -${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = max(${inputs[0]}, -${inputs[1]});`,
    },
  },
  "SDF",
  ["sdf", "subtract", "difference", "cut", "boolean", "operation"]
);
