import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const RotateAroundPointNode = new NodeType(
  "Rotate Around Point",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Angle", type: "float" },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: `vec2 rotateAroundPoint(vec2 uv, vec2 center, float angle) {
    vec2 dir = uv - center;
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * dir + center;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `vec2 rotateAroundPoint(vec2 uv, vec2 center, float angle) {
    vec2 dir = uv - center;
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * dir + center;
}`,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn rotateAroundPoint(uv: vec2<f32>, center: vec2<f32>, angle: f32) -> vec2<f32> {
    let dir = uv - center;
    let s = sin(angle);
    let c = cos(angle);
    let rot = mat2x2<f32>(c, -s, s, c);
    return rot * dir + center;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = rotateAroundPoint(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "Vector",
  ["rotate", "rotation", "pivot", "transform", "uv"]
);
