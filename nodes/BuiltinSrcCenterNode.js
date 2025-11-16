import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BuiltinSrcCenterNode = new NodeType(
  "srcCenter",
  [],
  [{ name: "Value", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency:
        "uniform mediump vec2 srcStart;\nuniform mediump vec2 srcEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcStart, srcEnd, 0.5);`,
    },
    webgl2: {
      dependency:
        "uniform mediump vec2 srcStart;\nuniform mediump vec2 srcEnd;",
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
