import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SamplerDepthNode = new NodeType(
  "samplerDepth",
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
  ["sampler", "depth", "texture", "layer", "z"]
);

// Metadata about this texture sampler
SamplerDepthNode.textureMetadata = {
  outputType: "float", // Shared output type for all shader languages
  webgl1: {
    samplerName: "samplerDepth",
  },
  webgl2: {
    samplerName: "samplerDepth",
  },
  webgpu: {
    textureName: "textureDepth",
    samplerName: "samplerDepth",
  },
};
