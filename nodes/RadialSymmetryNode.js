import { NodeType } from "./NodeType.js";

export const RadialSymmetryNode = new NodeType(
  "Radial Symmetry",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Folds", type: "int" },
  ],
  [{ name: "Result", type: "vec2" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec2 radialSymmetry(vec2 uv, vec2 center, int folds) {
    vec2 d = uv - center;
    float pi = 3.14159265359;
    float angle = atan(d.y, d.x);
    float segment = 2.0 * pi / float(folds);
    angle = mod(angle, segment);
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    float r = length(d);
    return center + vec2(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `vec2 radialSymmetry(vec2 uv, vec2 center, int folds) {
    vec2 d = uv - center;
    float pi = 3.14159265359;
    float angle = atan(d.y, d.x);
    float segment = 2.0 * pi / float(folds);
    angle = mod(angle, segment);
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    float r = length(d);
    return center + vec2(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn radialSymmetry(uv: vec2<f32>, center: vec2<f32>, folds: i32) -> vec2<f32> {
    let d = uv - center;
    let pi = 3.14159265359;
    var angle = atan2(d.y, d.x);
    let segment = 2.0 * pi / f32(folds);
    angle = angle % segment;
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    let r = length(d);
    return center + vec2<f32>(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "UV",
  ["radial", "symmetry", "kaleidoscope", "fold", "mirror", "uv"]
);
