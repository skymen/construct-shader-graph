import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinLayoutSizeNode = new NodeType(
  "layoutSize",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = layoutEnd - layoutStart;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = layoutEnd - layoutStart;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.layoutEnd - c3Params.layoutStart;`,
    },
  },
  "Builtin",
  ["layout", "size", "dimensions", "width", "height"]
);
