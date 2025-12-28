import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const CartesianToSphericalNode = new NodeType(
  "Cartesian to Spherical",
  [{ name: "Position", type: "vec3" }],
  [
    { name: "Radius", type: "float" },
    { name: "Theta", type: "float" },
    { name: "Phi", type: "float" },
  ],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]});
    float ${outputs[1]} = acos(${inputs[0]}.z / ${outputs[0]});
    float ${outputs[2]} = atan(${inputs[0]}.y, ${inputs[0]}.x);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = length(${inputs[0]});
    float ${outputs[1]} = acos(${inputs[0]}.z / ${outputs[0]});
    float ${outputs[2]} = atan(${inputs[0]}.y, ${inputs[0]}.x);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = length(${inputs[0]});
    var ${outputs[1]}: f32 = acos(${inputs[0]}.z / ${outputs[0]});
    var ${outputs[2]}: f32 = atan2(${inputs[0]}.y, ${inputs[0]}.x);`,
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
