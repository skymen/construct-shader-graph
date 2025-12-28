import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinDestCenterNode = new NodeType(
  "destCenter",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (destStart + destEnd) * 0.5;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (destStart + destEnd) * 0.5;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = (c3Params.destStart + c3Params.destEnd) * 0.5;`,
    },
  },
  "Builtin",
  ["destination", "center", "position", "midpoint"]
);
