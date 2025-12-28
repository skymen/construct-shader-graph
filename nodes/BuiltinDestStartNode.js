import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinDestStartNode = new NodeType(
  "destStart",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = destStart;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = destStart;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3Params.destStart;`,
    },
  },
  "Builtin",
  ["destination", "start", "position"]
);
