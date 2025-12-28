import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ENode = new NodeType(
  "E",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 2.71828182846;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 2.71828182846;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = 2.71828182846;`,
    },
  },
  "Constants",
  ["e", "euler", "constant", "math", "exponential"]
);
