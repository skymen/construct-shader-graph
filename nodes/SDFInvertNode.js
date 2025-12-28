import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFInvertNode = new NodeType(
  "SDF Invert",
  [{ name: "SDF", type: "float" }],
  [{ name: "Distance", type: "float" }],
  NODE_COLORS.sdfOperation,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = -${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = -${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = -${inputs[0]};`,
    },
  },
  "SDF",
  ["sdf", "invert", "negate", "flip", "inside", "outside", "operation"]
);
