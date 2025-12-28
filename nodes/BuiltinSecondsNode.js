import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinSecondsNode = new NodeType(
  "seconds",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = seconds;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = seconds;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3Params.seconds;`,
    },
  },
  "Builtin",
  ["time", "elapsed", "duration"]
);
