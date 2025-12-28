import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinZFarNode = new NodeType(
  "zFar",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = zFar;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = zFar;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3Params.zFar;`,
    },
  },
  "Builtin",
  ["z", "far", "depth", "camera"]
);
