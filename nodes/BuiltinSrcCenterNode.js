import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinSrcCenterNode = new NodeType(
  "srcCenter",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcStart, srcEnd, 0.5);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcStart, srcEnd, 0.5);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = mix(c3Params.srcStart, c3Params.srcEnd, 0.5);`,
    },
  },
  "Builtin",
  ["source", "center", "middle", "midpoint"]
);
