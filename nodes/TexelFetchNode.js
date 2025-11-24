import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const TexelFetchNode = new NodeType(
  "Texel Fetch",
  [
    { name: "Sampler", type: "texture" },
    { name: "X", type: "int" },
    { name: "Y", type: "int" },
    { name: "LOD", type: "int" },
  ],
  [{ name: "Color", type: "custom" }],
  "#90e24a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl1");
        return `    ${outputTypes[0]} ${outputs[0]} = texelFetch(${samplerName}, ivec2(${inputs[1]}, ${inputs[2]}), ${inputs[3]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerName = getSamplerName(node, "webgl2");
        return `    ${outputTypes[0]} ${outputs[0]} = texelFetch(${samplerName}, ivec2(${inputs[1]}, ${inputs[2]}), ${inputs[3]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const samplerPort = node.inputPorts[0];
        let textureName = "textureFront";

        if (samplerPort && samplerPort.connections.length > 0) {
          const wire = samplerPort.connections[0];
          const sourceNode = wire.startPort.node;
          if (
            sourceNode.nodeType.textureMetadata &&
            sourceNode.nodeType.textureMetadata.webgpu
          ) {
            const metadata = sourceNode.nodeType.textureMetadata.webgpu;
            textureName = metadata.textureName;
          }
        }

        // Convert resolved output type to WGSL format
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = textureLoad(${textureName}, vec2<i32>(${inputs[1]}, ${inputs[2]}), ${inputs[3]});`;
      },
    },
  },
  "Texture",
  ["texel", "fetch", "load", "read", "pixel", "direct", "unfiltered"]
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
TexelFetchNode.getCustomType = (node, port) => {
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
    // Default to vec4 if no sampler connected
    return "vec4";
  }
  return port.portType;
};
