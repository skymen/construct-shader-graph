import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const PixelSizeNode = new NodeType(
  "pixelSize",
  [],
  [{ name: "Value", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = pixelSize;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = pixelSize;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_getPixelSize(textureFront);`,
    },
  },
  "Builtin",
  ["pixel", "size", "dimensions", "texture"]
);
