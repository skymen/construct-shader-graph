import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const TextureVariableNode = new NodeType(
  "Texture Variable",
  [],
  [{ name: "Value", type: "texture" }],
  PORT_TYPES.texture.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    // sampler2D ${outputs[0]} = uTexture;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    // sampler2D ${outputs[0]} = uTexture;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    // texture_2d<f32> ${outputs[0]} = uTexture;`,
    },
  }
);
