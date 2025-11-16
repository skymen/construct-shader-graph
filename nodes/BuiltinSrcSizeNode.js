import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BuiltinSrcSizeNode = new NodeType(
  "srcSize",
  [],
  [{ name: "Value", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency:
        "uniform mediump vec2 srcStart;\nuniform mediump vec2 srcEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcEnd - srcStart;`,
    },
    webgl2: {
      dependency:
        "uniform mediump vec2 srcStart;\nuniform mediump vec2 srcEnd;",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcEnd - srcStart;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.srcEnd - c3Params.srcStart;`,
    },
  },
  "Builtin",
  ["source", "size", "dimensions", "width", "height"]
);
