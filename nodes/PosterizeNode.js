import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PosterizeNode = new NodeType(
  "Posterize",
  [
    { name: "Color", type: "vec3" },
    { name: "Levels", type: "float", defaultValue: 10.0 },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = floor(${inputs[0]} * ${inputs[1]}) / ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = floor(${inputs[0]} * ${inputs[1]}) / ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = floor(${inputs[0]} * ${inputs[1]}) / ${inputs[1]};`,
    },
  },
  "Color",
  ["posterize", "quantize", "color", "levels", "reduce"]
);
