import { NodeType } from "./NodeType.js";

export const SDFFillNode = new NodeType(
  "SDF Fill",
  [
    { name: "SDF", type: "float" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Mask", type: "float" }],
  "#6e4a2d",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 1.0 - smoothstep(-${inputs[1]}, ${inputs[1]}, ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = 1.0 - smoothstep(-${inputs[1]}, ${inputs[1]}, ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = 1.0 - smoothstep(-${inputs[1]}, ${inputs[1]}, ${inputs[0]});`,
    },
  },
  "SDF",
  ["sdf", "fill", "mask", "alpha", "solid", "output"]
);
