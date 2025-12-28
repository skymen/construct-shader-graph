import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PolarToCartesianNode = new NodeType(
  "Polar to Cartesian",
  [
    { name: "Radius", type: "float" },
    { name: "Angle", type: "float" },
  ],
  [{ name: "UV", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = vec2(${inputs[0]} * cos(${inputs[1]}), ${inputs[0]} * sin(${inputs[1]}));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = vec2(${inputs[0]} * cos(${inputs[1]}), ${inputs[0]} * sin(${inputs[1]}));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]} * cos(${inputs[1]}), ${inputs[0]} * sin(${inputs[1]}));`,
    },
  },
  "Vector",
  ["polar", "cartesian", "coordinates", "conversion", "radius", "angle"]
);
