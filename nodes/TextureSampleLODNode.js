import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import { toWGSLType } from "./PortTypes.js";

export const TextureSampleLODNode = new NodeType(
  "Texture Sample LOD",
  [
    { name: "Sampler", type: "texture" },
    { name: "UV", type: "vec2" },
    { name: "LOD", type: "float" },
  ],
  [{ name: "Color", type: "custom" }],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: `#extension GL_EXT_shader_texture_lod : enable`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl1");
        return `    ${outputTypes[0]} ${outputs[0]} = texture2DLodEXT(${samplerName}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl2");
        return `    ${outputTypes[0]} ${outputs[0]} = textureLod(${samplerName}, ${inputs[1]}, ${inputs[2]});`;
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
        return `    var ${outputs[0]}: ${wgslType} = textureSampleLevel(${textureName}, ${samplerName}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
  },
  "Texture",
  ["texture", "sample", "lod", "mipmap", "level", "detail"]
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
TextureSampleLODNode.getCustomType = (node, port) => {
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
