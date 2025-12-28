import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinSrcOriginStartNode = new NodeType(
  "srcOriginStart",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcOriginStart;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = srcOriginStart;`,
    },
    webgpu: {
      dependency: "",
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.srcOriginStart;`,
    },
  },
  "Builtin",
  ["source", "origin", "start", "position"]
);
