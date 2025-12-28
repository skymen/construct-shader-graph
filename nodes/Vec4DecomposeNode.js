import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec4DecomposeNode = new NodeType(
  "Vec4 Decompose",
  [{ name: "Vec4", type: "vec4" }],
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
    { name: "Z", type: "float" },
    { name: "W", type: "float" },
  ],
  NODE_COLORS.colorVec4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;\n    float ${outputs[2]} = ${inputs[0]}.z;\n    float ${outputs[3]} = ${inputs[0]}.w;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;\n    float ${outputs[2]} = ${inputs[0]}.z;\n    float ${outputs[3]} = ${inputs[0]}.w;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]}.x;\n    var ${outputs[1]}: f32 = ${inputs[0]}.y;\n    var ${outputs[2]}: f32 = ${inputs[0]}.z;\n    var ${outputs[3]}: f32 = ${inputs[0]}.w;`,
    },
  },
  "Vector",
  ["split", "break", "separate", "rgba", "color", "xyzw"]
);
