import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// One literal, shared by the emitted source and the constant folder, so the two
// cannot drift apart.
const EPSILON_LITERAL = "0.00001";

export const EpsilonNode = new NodeType(
  "Epsilon",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${EPSILON_LITERAL};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${EPSILON_LITERAL};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${EPSILON_LITERAL};`,
    },
  },
  "Constants",
  ["epsilon", "constant", "small", "threshold", "precision"]
);

EpsilonNode.foldConstant = () => Number(EPSILON_LITERAL);
