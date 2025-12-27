import { NodeType } from "./NodeType.js";

export const CircleSDFNode = new NodeType(
  "Circle SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Radius", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]} - ${inputs[1]}) - ${inputs[2]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]} - ${inputs[1]}) - ${inputs[2]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = length(${inputs[0]} - ${inputs[1]}) - ${inputs[2]};`,
    },
  },
  "SDF",
  ["sdf", "circle", "disk", "round", "shape", "distance", "field"]
);
