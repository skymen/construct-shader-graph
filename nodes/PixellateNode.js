import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PixellateNode = new NodeType(
  "Pixellate",
  [
    { name: "UV", type: "vec2" },
    { name: "PixelSize", type: "vec2" },
  ],
  [{ name: "UV", type: "vec2" }],
  NODE_COLORS.uvTransform,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = floor(${inputs[0]} / ${inputs[1]}) * ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = floor(${inputs[0]} / ${inputs[1]}) * ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = floor(${inputs[0]} / ${inputs[1]}) * ${inputs[1]};`,
    },
  },
  "UV",
  ["pixellate", "pixelate", "mosaic", "uv", "effect", "pixel"]
);
