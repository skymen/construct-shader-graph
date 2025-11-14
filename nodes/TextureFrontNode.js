import { NodeType } from "./NodeType.js";

export const TextureFrontNode = new NodeType(
  "Front Texture",
  [{ name: "UV", type: "vector" }],
  [{ name: "Color", type: "color" }],
  "#3a4a4a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture2D(samplerFront, ${inputs[0]}.xy);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture(samplerFront, ${inputs[0]}.xy);`,
    },
    webgpu: {
      dependency: `%%SAMPLERFRONT_BINDING%% var samplerFront : sampler;
%%TEXTUREFRONT_BINDING%% var textureFront : texture_2d<f32>;`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = textureSample(textureFront, samplerFront, ${inputs[0]}.xy);`,
    },
  }
);
