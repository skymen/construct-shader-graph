import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const TranslationMatrixNode = new NodeType(
  "Translation Matrix",
  [{ name: "Translation", type: "vec3" }],
  [{ name: "Matrix", type: "mat4" }],
  NODE_COLORS.colorMat4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mat4 ${outputs[0]} = mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, ${inputs[0]}.x, ${inputs[0]}.y, ${inputs[0]}.z, 1.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mat4 ${outputs[0]} = mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, ${inputs[0]}.x, ${inputs[0]}.y, ${inputs[0]}.z, 1.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: mat4x4<f32> = mat4x4<f32>(vec4<f32>(1.0, 0.0, 0.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), vec4<f32>(0.0, 0.0, 1.0, 0.0), vec4<f32>(${inputs[0]}.x, ${inputs[0]}.y, ${inputs[0]}.z, 1.0));`,
    },
  },
  "Matrix",
  ["translation", "matrix", "transform", "move", "position", "offset"]
);
