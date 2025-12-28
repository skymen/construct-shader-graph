import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import { toWGSLType } from "./PortTypes.js";

export const TextureSampleNode = new NodeType(
  "Texture Sample",
  [
    { name: "Sampler", type: "texture" },
    { name: "UV", type: "vec2" },
  ],
  [{ name: "Color", type: "custom" }],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl1");
        return `    ${outputTypes[0]} ${outputs[0]} = texture2D(${samplerName}, ${inputs[1]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl2");
        return `    ${outputTypes[0]} ${outputs[0]} = texture(${samplerName}, ${inputs[1]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerPort = node.inputPorts[0];
        let textureName = "textureFront";
        let samplerName = "samplerFront";

        if (samplerPort && samplerPort.connections.length > 0) {
          const wire = samplerPort.connections[0];
          const sourceNode = wire.startPort.node;
          if (
            sourceNode.nodeType.textureMetadata &&
            sourceNode.nodeType.textureMetadata.webgpu
          ) {
            const metadata = sourceNode.nodeType.textureMetadata.webgpu;
            textureName = metadata.textureName;
            samplerName = metadata.samplerName;
          }
        }

        // Convert resolved output type to WGSL format
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = textureSample(${textureName}, ${samplerName}, ${inputs[1]});`;
      },
    },
  },
  "Texture",
  ["texture", "sample", "sampler", "read"]
);

// Helper function to get sampler name from connected texture node
function getSamplerName(node, shaderTarget) {
  const samplerPort = node.inputPorts[0]; // Sampler input
  if (samplerPort && samplerPort.connections.length > 0) {
    const wire = samplerPort.connections[0];
    const sourceNode = wire.startPort.node;
    if (
      sourceNode.nodeType.textureMetadata &&
      sourceNode.nodeType.textureMetadata[shaderTarget]
    ) {
      return sourceNode.nodeType.textureMetadata[shaderTarget].samplerName;
    }
  }
  return "samplerFront"; // Default fallback
}

// Custom type resolution for output
TextureSampleNode.getCustomType = (node, port) => {
  if (port.type === "output") {
    // Get the connected sampler node
    const samplerPort = node.inputPorts[0];
    if (samplerPort && samplerPort.connections.length > 0) {
      const wire = samplerPort.connections[0];
      const sourceNode = wire.startPort.node;
      if (sourceNode.nodeType.textureMetadata) {
        // Use shared output type
        return sourceNode.nodeType.textureMetadata.outputType;
      }
    }
    // Default to T (generic type) if no sampler connected
    return "T";
  }
  return port.portType;
};

// Manual entry for documentation
TextureSampleNode.manual = {
  description: "Reads a color value from a texture at the specified UV coordinates. This is the primary way to sample textures in your shader.",
  html: `
    <h4>How to Use</h4>
    <ol>
      <li>Connect a texture sampler (e.g., <code>samplerFront</code>) to the Sampler input</li>
      <li>Connect UV coordinates (e.g., <code>Front UV</code>) to the UV input</li>
      <li>The Color output gives you the RGBA value at that position</li>
    </ol>
    
    <h4>UV Coordinates</h4>
    <p>UV coordinates typically range from (0,0) at the top-left to (1,1) at the bottom-right:</p>
    <ul>
      <li><code>(0, 0)</code> - Top-left corner</li>
      <li><code>(1, 0)</code> - Top-right corner</li>
      <li><code>(0, 1)</code> - Bottom-left corner</li>
      <li><code>(1, 1)</code> - Bottom-right corner</li>
    </ul>
    
    <h4>Modifying UVs</h4>
    <p>Modify the UV coordinates before sampling to create effects:</p>
    <ul>
      <li><strong>Scale UV:</strong> Zoom in/out of the texture</li>
      <li><strong>Twirl:</strong> Create spiral distortions</li>
      <li><strong>Wrap UV:</strong> Tile the texture</li>
      <li><strong>Add offset:</strong> Scroll the texture</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> UVs outside 0-1 range will wrap or clamp based on texture settings. Use <code>Wrap UV</code> for controlled tiling.
    </div>
  `
};
