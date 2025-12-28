import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const InvertNode = new NodeType(
  "Invert",
  [{ name: "Color", type: "vec3" }],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(1.0) - ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(1.0) - ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(1.0) - ${inputs[0]};`,
    },
  },
  "Color",
  ["invert", "negative", "color", "reverse"]
);
