import { NodeType } from "./NodeType.js";

export const CartesianToPolarNode = new NodeType(
  "Cartesian to Polar",
  [{ name: "UV", type: "vec2" }],
  [
    { name: "Radius", type: "float" },
    { name: "Angle", type: "float" },
  ],
  "#3a4a5a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]});
    float ${outputs[1]} = atan(${inputs[0]}.y, ${inputs[0]}.x);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]});
    float ${outputs[1]} = atan(${inputs[0]}.y, ${inputs[0]}.x);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = length(${inputs[0]});
    var ${outputs[1]}: f32 = atan2(${inputs[0]}.y, ${inputs[0]}.x);`,
    },
  },
  "Vector",
  ["polar", "cartesian", "coordinates", "conversion", "radius", "angle"]
);
