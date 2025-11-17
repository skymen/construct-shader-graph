import { NodeType } from "./NodeType.js";

export const TextureBackNode = new NodeType(
  "Back Texture",
  [{ name: "UV", type: "vec2" }],
  [
    { name: "RGBA", type: "vec4" },
    { name: "Color", type: "vec3" },
    { name: "Alpha", type: "float" },
  ],
  "#3a4a4a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture2D(samplerBack, ${inputs[0]});\n` +
        `    vec3 ${outputs[1]} = ${outputs[0]}.xyz;\n` +
        `    float ${outputs[2]} = ${outputs[0]}.a;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = texture(samplerBack, ${inputs[0]});\n` +
        `    vec3 ${outputs[1]} = ${outputs[0]}.xyz;\n` +
        `    float ${outputs[2]} = ${outputs[0]}.a;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = textureSample(textureBack, samplerBack, ${inputs[0]});\n` +
        `    var ${outputs[1]}: vec3<f32> = ${outputs[0]}.xyz;\n` +
        `    var ${outputs[2]}: f32 = ${outputs[0]}.a;`,
    },
  },
  "Texture",
  ["sample", "back", "layer", "background"]
);
