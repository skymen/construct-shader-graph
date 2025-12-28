import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const TauNode = new NodeType(
  "Tau",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 6.28318530718;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 6.28318530718;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = 6.28318530718;`,
    },
  },
  "Constants",
  ["tau", "constant", "math", "circle", "2pi"]
);
