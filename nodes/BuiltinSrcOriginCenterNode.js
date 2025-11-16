import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BuiltinSrcOriginCenterNode = new NodeType(
  "srcOriginCenter",
  [],
  [{ name: "Value", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency:
        "uniform mediump vec2 srcOriginStart;\nuniform mediump vec2 srcOriginEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, 0.5);`,
    },
    webgl2: {
      dependency:
        "uniform mediump vec2 srcOriginStart;\nuniform mediump vec2 srcOriginEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, 0.5);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = mix(c3Params.srcOriginStart, c3Params.srcOriginEnd, 0.5);`,
    },
  },
  "Builtin",
  ["source", "origin", "center", "middle", "midpoint"]
);
