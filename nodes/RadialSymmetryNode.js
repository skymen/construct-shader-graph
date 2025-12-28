import { NodeType } from "./NodeType.js";

export const RadialSymmetryNode = new NodeType(
  "Radial Symmetry",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Folds", type: "int" },
    { name: "Fold Angle", type: "float" },
    { name: "Sample Angle", type: "float" },
  ],
  [{ name: "Result", type: "vec2" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec2 radialSymmetry(vec2 uv, vec2 center, int folds, float foldAngle, float sampleAngle) {
    vec2 d = uv - center;
    float pi = 3.14159265359;
    float tau = 2.0 * pi;
    float angle = atan(d.y, d.x) + pi - foldAngle;
    angle = mod(angle, tau) + tau;
    float segment = tau / float(folds);
    angle = mod(angle, segment);
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    angle += foldAngle + sampleAngle;
    float r = length(d);
    return center + vec2(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgl2: {
      dependency: `vec2 radialSymmetry(vec2 uv, vec2 center, int folds, float foldAngle, float sampleAngle) {
    vec2 d = uv - center;
    float pi = 3.14159265359;
    float tau = 2.0 * pi;
    float angle = atan(d.y, d.x) + pi - foldAngle;
    angle = mod(angle, tau) + tau;
    float segment = tau / float(folds);
    angle = mod(angle, segment);
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    angle += foldAngle + sampleAngle;
    float r = length(d);
    return center + vec2(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgpu: {
      dependency: `fn radialSymmetry(uv: vec2<f32>, center: vec2<f32>, folds: i32, foldAngle: f32, sampleAngle: f32) -> vec2<f32> {
    let d = uv - center;
    let pi = 3.14159265359;
    let tau = 2.0 * pi;
    var angle = atan2(d.y, d.x) + pi - foldAngle;
    angle = (angle % tau) + tau;
    let segment = tau / f32(folds);
    angle = angle % segment;
    if (angle > segment * 0.5) {
        angle = segment - angle;
    }
    angle += foldAngle + sampleAngle;
    let r = length(d);
    return center + vec2<f32>(cos(angle), sin(angle)) * r;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = radialSymmetry(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
  },
  "UV",
  ["radial", "symmetry", "kaleidoscope", "fold", "mirror", "uv", "rotate"]
);
