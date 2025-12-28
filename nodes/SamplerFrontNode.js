import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SamplerFrontNode = new NodeType(
  "samplerFront",
  [],
  [{ name: "Sampler", type: "texture" }],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: "",
      execution: () => "", // No execution code needed, just provides the sampler reference
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
  ["sampler", "front", "texture", "layer"]
);

// Metadata about this texture sampler
SamplerFrontNode.textureMetadata = {
  outputType: "vec4", // Shared output type for all shader languages
  webgl1: {
    samplerName: "samplerFront",
  },
  webgl2: {
    samplerName: "samplerFront",
  },
  webgpu: {
    textureName: "textureFront",
    samplerName: "samplerFront",
  },
};

// Manual entry for documentation
SamplerFrontNode.manual = {
  description: "Provides access to the front texture sampler, which contains the current object's rendered texture. This is the primary texture you'll sample in most effects.",
  html: `
    <h4>What is the Front Texture?</h4>
    <p>The front texture contains the rendered appearance of the object before your shader effect is applied. This allows you to read and modify the object's pixels.</p>
    
    <h4>Usage</h4>
    <p>Connect this sampler to a <strong>Texture Sample</strong> node along with UV coordinates to read pixel colors from the texture.</p>
    
    <h4>Typical Setup</h4>
    <ol>
      <li>Add a <code>samplerFront</code> node</li>
      <li>Add a <code>Front UV</code> node for coordinates</li>
      <li>Connect both to a <code>Texture Sample</code> node</li>
      <li>Process the resulting color</li>
      <li>Connect to the <code>Output</code> node</li>
    </ol>
    
    <div class="warning">
      <strong>Note:</strong> This sampler is specific to Construct 3's shader system. The texture contains the object's appearance at the current rendering stage.
    </div>
  `
};
