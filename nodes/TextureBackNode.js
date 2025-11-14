import { NodeType } from "./NodeType.js";

export const TextureBackNode = new NodeType(
  "Back Texture",
  [{ name: "UV", type: "vector" }],
  [{ name: "Color", type: "color" }],
  "#3a4a4a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture2D(samplerBack, ${inputs[0]}.xy);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture(samplerBack, ${inputs[0]}.xy);`,
    },
    webgpu: {
      dependency: `%%SAMPLERBACK_BINDING%% var samplerBack : sampler;
%%TEXTUREBACK_BINDING%% var textureBack : texture_2d<f32>;`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = textureSample(textureBack, samplerBack, ${inputs[0]}.xy);`,
    },
  }
);
