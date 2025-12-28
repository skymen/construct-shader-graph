import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const LinearizeDepthNode = new NodeType(
  "Linearize Depth",
  [{ name: "Depth", type: "float" }],
  [{ name: "Linear", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = zNear * zFar / (zFar + ${inputs[0]} * (zNear - zFar));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = zNear * zFar / (zFar + ${inputs[0]} * (zNear - zFar));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3_linearizeDepth(${inputs[0]});`,
    },
  },
  "Utility",
  ["depth", "linear", "z", "buffer"]
);
