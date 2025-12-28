import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFAnnularNode = new NodeType(
  "SDF Annular",
  [
    { name: "SDF", type: "float" },
    { name: "Thickness", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  NODE_COLORS.sdfOperation,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = abs(${inputs[0]}) - ${inputs[1]} * 0.5;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = abs(${inputs[0]}) - ${inputs[1]} * 0.5;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = abs(${inputs[0]}) - ${inputs[1]} * 0.5;`,
    },
  },
  "SDF",
  ["sdf", "annular", "ring", "outline", "stroke", "hollow", "operation"]
);
