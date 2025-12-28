import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec2DecomposeNode = new NodeType(
  "Vec2 Decompose",
  [{ name: "Vec2", type: "vec2" }],
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
  ],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]}.x;\n    float ${outputs[1]} = ${inputs[0]}.y;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]}.x;\n    var ${outputs[1]}: f32 = ${inputs[0]}.y;`,
    },
  },
  "Vector",
  ["split", "break", "separate", "2d", "xy"]
);
