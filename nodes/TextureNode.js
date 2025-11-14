import { NodeType } from "./NodeType.js";

export const TextureNode = new NodeType(
  "Texture Sample",
  [
    { name: "Texture", type: "texture" },
    { name: "UV", type: "vector" },
  ],
  [{ name: "Color", type: "color" }],
  "#3a4a4a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = texture2D(${inputs[0]}, ${inputs[1]}.xy).rgb;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = texture(${inputs[0]}, ${inputs[1]}.xy).rgb;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = textureSample(uTexture, uSampler, ${inputs[1]}.xy).rgb;`,
    },
  }
);
