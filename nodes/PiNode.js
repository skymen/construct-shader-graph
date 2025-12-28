import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PiNode = new NodeType(
  "Pi",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 3.14159265359;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 3.14159265359;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = 3.14159265359;`,
    },
  },
  "Constants",
  ["pi", "constant", "math", "circle"]
);
