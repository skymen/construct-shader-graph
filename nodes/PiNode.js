import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// One literal, shared by the emitted source and the constant folder, so the two
// cannot drift apart.
const PI_LITERAL = "3.14159265359";

export const PiNode = new NodeType(
  "Pi",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = ${PI_LITERAL};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = ${PI_LITERAL};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${PI_LITERAL};`,
    },
  },
  "Constants",
  ["pi", "constant", "math", "circle"]
);

PiNode.foldConstant = () => Number(PI_LITERAL);
