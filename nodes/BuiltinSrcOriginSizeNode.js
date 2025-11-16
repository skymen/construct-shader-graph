import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BuiltinSrcOriginSizeNode = new NodeType(
  "srcOriginSize",
  [],
  [{ name: "Value", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency:
        "uniform mediump vec2 srcOriginStart;\nuniform mediump vec2 srcOriginEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcOriginEnd - srcOriginStart;`,
    },
    webgl2: {
      dependency:
        "uniform mediump vec2 srcOriginStart;\nuniform mediump vec2 srcOriginEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcOriginEnd - srcOriginStart;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.srcOriginEnd - c3Params.srcOriginStart;`,
    },
  },
  "Builtin",
  ["source", "origin", "size", "dimensions", "width", "height"]
);
