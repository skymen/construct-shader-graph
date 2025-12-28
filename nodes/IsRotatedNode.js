import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const IsRotatedNode = new NodeType(
  "Is Rotated",
  [], // No inputs
  [{ name: "Rotated", type: "bool" }],
  NODE_COLORS.colorBool,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = srcOriginStart.y > srcOriginEnd.y;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    bool ${outputs[0]} = srcOriginStart.y > srcOriginEnd.y;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: bool = bool(c3Params.isSrcTexRotated);`,
    },
  },
  "Builtin",
  ["is rotated", "rotated", "rotation", "rotation check"]
);
