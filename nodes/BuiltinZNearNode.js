import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinZNearNode = new NodeType(
  "zNear",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = zNear;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = zNear;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3Params.zNear;`,
    },
  },
  "Builtin",
  ["z", "near", "depth", "camera"]
);
