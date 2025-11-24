import { NodeType } from "./NodeType.js";

export const TextureDimensionsNode = new NodeType(
  "Texture Dimensions",
  [{ name: "Sampler", type: "texture" }],
  [
    { name: "Size", type: "vec2" },
    { name: "Width", type: "int" },
    { name: "Height", type: "int" },
  ],
  "#90e24a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const samplerName = getSamplerName(node, "webgl1");
        return `    vec2 ${outputs[0]}_ivec2 = textureSize(${samplerName}, 0);
        vec2 ${outputs[0]} = vec2(${outputs[0]}_ivec2);
        int ${outputs[1]} = ${outputs[0]}_ivec2.x;
        int ${outputs[2]} = ${outputs[0]}_ivec2.y;`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const samplerName = getSamplerName(node, "webgl2");
        return `    vec2 ${outputs[0]}_ivec2 = textureSize(${samplerName}, 0);
        vec2 ${outputs[0]} = vec2(${outputs[0]}_ivec2);
        int ${outputs[1]} = ${outputs[0]}_ivec2.x;
        int ${outputs[2]} = ${outputs[0]}_ivec2.y;`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
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

        return `    var ${outputs[0]}_ivec2: vec2<u32> = textureDimensions(${textureName});
        var ${outputs[0]}: vec2<f32> = vec2<f32>(${outputs[0]}_ivec2);
        var ${outputs[1]}: i32 = i32(${outputs[0]}_ivec2.x);
        var ${outputs[2]}: i32 = i32(${outputs[0]}_ivec2.y);`;
      },
    },
  },
  "Texture",
  ["dimensions", "size", "width", "height", "texture"]
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
