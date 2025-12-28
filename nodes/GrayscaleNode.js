import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const GrayscaleNode = new NodeType(
  "Grayscale",
  [{ name: "RGB", type: "vec3" }],
  [{ name: "Gray", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = dot(${inputs[0]}, vec3(0.299, 0.587, 0.114));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = dot(${inputs[0]}, vec3(0.299, 0.587, 0.114));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3_grayscale(${inputs[0]});`,
    },
  },
  "Color",
  ["grayscale", "gray", "luminance", "brightness", "color"]
);
