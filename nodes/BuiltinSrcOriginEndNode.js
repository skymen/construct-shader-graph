import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinSrcOriginEndNode = new NodeType(
  "srcOriginEnd",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = srcOriginEnd;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = srcOriginEnd;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.srcOriginEnd;`,
    },
  },
  "Builtin",
  ["source", "origin", "end", "position"]
);
