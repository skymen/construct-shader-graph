import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const HueNode = new NodeType(
  "Hue",
  [
    { name: "Color", type: "vec3" },
    { name: "Shift", type: "float" },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.colorAdjust,
  {
    webgl1: {
      dependency: `vec3 hue_rgb2hsl(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hue_hsl2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`,
      execution: (inputs, outputs) =>
        `    vec3 hsl = hue_rgb2hsl(${inputs[0]});\n` +
        `    hsl.x = fract(hsl.x + ${inputs[1]});\n` +
        `    vec3 ${outputs[0]} = hue_hsl2rgb(hsl);`,
    },
    webgl2: {
      dependency: `vec3 hue_rgb2hsl(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hue_hsl2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`,
      execution: (inputs, outputs) =>
        `    vec3 hsl = hue_rgb2hsl(${inputs[0]});\n` +
        `    hsl.x = fract(hsl.x + ${inputs[1]});\n` +
        `    vec3 ${outputs[0]} = hue_hsl2rgb(hsl);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var hsl: vec3<f32> = c3_RGBtoHSL(${inputs[0]});\n` +
        `    hsl.x = fract(hsl.x + ${inputs[1]});\n` +
        `    var ${outputs[0]}: vec3<f32> = c3_HSLtoRGB(hsl);`,
    },
  },
  "Color",
  ["hue", "shift", "color", "adjust", "hsv"]
);
