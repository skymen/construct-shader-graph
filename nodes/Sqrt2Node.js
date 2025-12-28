import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Sqrt2Node = new NodeType(
  "Sqrt(2)",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 1.41421356237;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 1.41421356237;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = 1.41421356237;`,
    },
  },
  "Constants",
  ["sqrt", "root", "constant", "math", "square"]
);
