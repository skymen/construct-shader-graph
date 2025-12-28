import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFFillNode = new NodeType(
  "SDF Fill",
  [
    { name: "SDF", type: "float" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Mask", type: "float" }],
  NODE_COLORS.sdfOutput,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float feather_${outputs[0]} = max(${inputs[1]}, 0.0001);
    float ${outputs[0]} = 1.0 - smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float feather_${outputs[0]} = max(${inputs[1]}, 0.0001);
    float ${outputs[0]} = 1.0 - smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var feather_${outputs[0]}: f32 = max(${inputs[1]}, 0.0001);
    var ${outputs[0]}: f32 = 1.0 - smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});`,
    },
  },
  "SDF",
  ["sdf", "fill", "mask", "alpha", "solid", "output"]
);
