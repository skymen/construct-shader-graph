import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinDevicePixelRatioNode = new NodeType(
  "devicePixelRatio",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = devicePixelRatio;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = devicePixelRatio;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3Params.devicePixelRatio;`,
    },
  },
  "Builtin",
  ["device", "pixel", "ratio", "dpr", "resolution"]
);
