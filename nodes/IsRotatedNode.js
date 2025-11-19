import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const IsRotatedNode = new NodeType(
  "Is Rotated",
  [], // No inputs
  [{ name: "Rotated", type: "bool" }],
  PORT_TYPES.bool.color,
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
        `    let ${outputs[0]}: bool = bool(c3Params.isSrcTexRotated);`,
    },
  },
  "Builtin",
  ["is rotated", "rotated", "rotation", "rotation check"]
);
