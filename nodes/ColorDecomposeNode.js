import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ColorDecomposeNode = new NodeType(
  "Color Decompose",
  [{ name: "Color", type: "vec4" }],
  [
    { name: "RGB", type: "vec3" },
    { name: "Alpha", type: "float" },
  ],
  NODE_COLORS.colorVec4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = ${inputs[0]}.rgb;\n    float ${outputs[1]} = ${inputs[0]}.a;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = ${inputs[0]}.rgb;\n    float ${outputs[1]} = ${inputs[0]}.a;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = ${inputs[0]}.rgb;\n    var ${outputs[1]}: f32 = ${inputs[0]}.a;`,
    },
  },
  "Vector",
  ["color", "decompose", "split", "rgba", "rgb", "alpha", "separate"]
);
