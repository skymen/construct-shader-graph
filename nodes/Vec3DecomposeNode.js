import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec3DecomposeNode = new NodeType(
  "Vec3 Decompose",
  [{ name: "Vec3", type: "vec3" }],
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
    { name: "Z", type: "float" },
  ],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;\n    float ${outputs[2]} = ${inputs[0]}.z;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;\n    float ${outputs[2]} = ${inputs[0]}.z;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]}.x;\n    var ${outputs[1]}: f32 = ${inputs[0]}.y;\n    var ${outputs[2]}: f32 = ${inputs[0]}.z;`,
    },
  },
  "Vector",
  ["split", "break", "separate", "3d", "rgb", "xyz"]
);
