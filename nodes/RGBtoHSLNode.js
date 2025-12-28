import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const RGBtoHSLNode = new NodeType(
  "RGB to HSL",
  [{ name: "RGB", type: "vec3" }],
  [{ name: "HSL", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: `vec3 rgb2hsl(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = rgb2hsl(${inputs[0]});`,
    },
    webgl2: {
      dependency: `vec3 rgb2hsl(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = rgb2hsl(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = c3_RGBtoHSL(${inputs[0]});`,
    },
  },
  "Color",
  ["rgb", "hsl", "color", "convert", "hue", "saturation", "lightness"]
);
