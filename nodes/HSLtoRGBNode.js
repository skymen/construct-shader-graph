import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const HSLtoRGBNode = new NodeType(
  "HSL to RGB",
  [{ name: "HSL", type: "vec3" }],
  [{ name: "RGB", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 hsl2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hsl2rgb(${inputs[0]});`,
    },
    webgl2: {
      dependency: `vec3 hsl2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = hsl2rgb(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = c3_HSLtoRGB(${inputs[0]});`,
    },
  },
  "Color",
  ["hsl", "rgb", "color", "convert", "hue", "saturation", "lightness"]
);
