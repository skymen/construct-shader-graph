import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SphericalToCartesianNode = new NodeType(
  "Spherical to Cartesian",
  [
    { name: "Radius", type: "float" },
    { name: "Theta", type: "float" },
    { name: "Phi", type: "float" },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float sinTheta = sin(${inputs[1]});
    vec3 ${outputs[0]} = vec3(
        ${inputs[0]} * sinTheta * cos(${inputs[2]}),
        ${inputs[0]} * sinTheta * sin(${inputs[2]}),
        ${inputs[0]} * cos(${inputs[1]})
    );`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float sinTheta = sin(${inputs[1]});
    vec3 ${outputs[0]} = vec3(
        ${inputs[0]} * sinTheta * cos(${inputs[2]}),
        ${inputs[0]} * sinTheta * sin(${inputs[2]}),
        ${inputs[0]} * cos(${inputs[1]})
    );`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    let sinTheta = sin(${inputs[1]});
    var ${outputs[0]}: vec3<f32> = vec3<f32>(
        ${inputs[0]} * sinTheta * cos(${inputs[2]}),
        ${inputs[0]} * sinTheta * sin(${inputs[2]}),
        ${inputs[0]} * cos(${inputs[1]})
    );`,
    },
  },
  "Vector",
  [
    "spherical",
    "cartesian",
    "coordinates",
    "conversion",
    "3d",
    "radius",
    "theta",
    "phi",
  ]
);
