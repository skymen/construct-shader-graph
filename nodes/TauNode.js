import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// One literal, shared by the emitted source and the constant folder, so the two
// cannot drift apart.
const TAU_LITERAL = "6.28318530718";

export const TauNode = new NodeType(
  "2Pi",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${TAU_LITERAL};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${TAU_LITERAL};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${TAU_LITERAL};`,
    },
  },
  "Constants",
  ["tau", "constant", "math", "circle", "2pi"],
);

TauNode.foldConstant = () => Number(TAU_LITERAL);
