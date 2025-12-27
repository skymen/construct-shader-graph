import { NodeType } from "./NodeType.js";

export const SDFOffsetNode = new NodeType(
  "SDF Offset",
  [
    { name: "SDF", type: "float" },
    { name: "Offset", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#4a6e2d",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} - ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} - ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]} - ${inputs[1]};`,
    },
  },
  "SDF",
  ["sdf", "offset", "expand", "shrink", "grow", "dilate", "erode", "operation"]
);
