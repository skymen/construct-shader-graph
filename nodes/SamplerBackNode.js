import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SamplerBackNode = new NodeType(
  "samplerBack",
  [],
  [{ name: "Sampler", type: "texture" }],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: "",
      execution: () => "",
    },
    webgl2: {
      dependency: "",
      execution: () => "",
    },
    webgpu: {
      dependency: "",
      execution: () => "",
    },
  },
  "Texture",
  ["sampler", "back", "background", "texture", "layer"]
);

// Metadata about this texture sampler
SamplerBackNode.textureMetadata = {
  outputType: "vec4", // Shared output type for all shader languages
  webgl1: {
    samplerName: "samplerBack",
  },
  webgl2: {
    samplerName: "samplerBack",
  },
  webgpu: {
    textureName: "textureBack",
    samplerName: "samplerBack",
  },
};
