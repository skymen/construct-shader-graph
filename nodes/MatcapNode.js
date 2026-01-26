import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const MatcapNode = new NodeType(
  "Matcap",
  [
    { name: "Normal", type: "vec3" },
    { name: "Matcap", type: "texture" },
  ],
  [{ name: "Color", type: "vec4" }],
  NODE_COLORS.textureSample,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const samplerName =
          node.inputs?.[1]?.connectedSampler || "samplerFront";
        return `    vec3 matcap_n_${outputs[0]} = normalize(${inputs[0]} * 2.0 - 1.0);
    vec2 matcap_uv_${outputs[0]} = matcap_n_${outputs[0]}.xy * 0.5 + 0.5;
    vec4 ${outputs[0]} = texture2D(${samplerName}, matcap_uv_${outputs[0]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const samplerName =
          node.inputs?.[1]?.connectedSampler || "samplerFront";
        return `    vec3 matcap_n_${outputs[0]} = normalize(${inputs[0]} * 2.0 - 1.0);
    vec2 matcap_uv_${outputs[0]} = matcap_n_${outputs[0]}.xy * 0.5 + 0.5;
    vec4 ${outputs[0]} = texture(${samplerName}, matcap_uv_${outputs[0]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const textureName =
          node.inputs?.[1]?.connectedTexture || "textureFront";
        const samplerName =
          node.inputs?.[1]?.connectedSampler || "samplerFront";
        return `    let matcap_n_${outputs[0]} = normalize(${inputs[0]} * 2.0 - 1.0);
    let matcap_uv_${outputs[0]} = matcap_n_${outputs[0]}.xy * 0.5 + 0.5;
    var ${outputs[0]}: vec4<f32> = textureSample(${textureName}, ${samplerName}, matcap_uv_${outputs[0]});`;
      },
    },
  },
  "Lighting",
  ["matcap", "lit", "sphere", "material", "capture", "stylized", "toon"]
);

MatcapNode.manual = {
  description:
    "Samples a matcap (material capture) texture using the surface normal. Matcaps are pre-baked lighting spheres that provide instant stylized shading.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Use matcap textures for quick stylized looks - toon shading, metallic effects, or artistic rendering.
    </div>
    <div class="tip">
      <strong>Note:</strong> Connect a texture sampler (like samplerFront with a matcap image) to the Matcap input.
    </div>
  `,
};
