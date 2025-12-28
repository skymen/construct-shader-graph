import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const EpsilonNode = new NodeType(
  "Epsilon",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = 0.00001;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = 0.00001;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) => `    var ${outputs[0]}: f32 = 0.00001;`,
    },
  },
  "Constants",
  ["epsilon", "constant", "small", "threshold", "precision"]
);
