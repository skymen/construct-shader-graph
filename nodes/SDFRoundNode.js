import { NodeType } from "./NodeType.js";

export const SDFRoundNode = new NodeType(
  "SDF Round",
  [
    { name: "SDF", type: "float" },
    { name: "Radius", type: "float" },
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
  ["sdf", "round", "bevel", "corner", "smooth", "operation"]
);
