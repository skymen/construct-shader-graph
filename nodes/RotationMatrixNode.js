import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const RotationMatrixNode = new NodeType(
  "Rotation Matrix",
  [
    { name: "Axis", type: "vec3" },
    { name: "Angle", type: "float" },
  ],
  [{ name: "Matrix", type: "mat4" }],
  PORT_TYPES.mat4.color,
  {
    webgl1: {
      dependency: `
// Build rotation matrix from axis and angle (radians)
mat4 rotation_matrix(vec3 axis, float angle) {
    vec3 a = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(
        oc * a.x * a.x + c,       oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s, 0.0,
        oc * a.x * a.y - a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z + a.x * s, 0.0,
        oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c,       0.0,
        0.0,                      0.0,                      0.0,                      1.0);
}
`,
      execution: (inputs, outputs) =>
        `    mat4 ${outputs[0]} = rotation_matrix(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: `
// Build rotation matrix from axis and angle (radians)
mat4 rotation_matrix(vec3 axis, float angle) {
    vec3 a = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(
        oc * a.x * a.x + c,       oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s, 0.0,
        oc * a.x * a.y - a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z + a.x * s, 0.0,
        oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c,       0.0,
        0.0,                      0.0,                      0.0,                      1.0);
}
`,
      execution: (inputs, outputs) =>
        `    mat4 ${outputs[0]} = rotation_matrix(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: `
// Build rotation matrix from axis and angle (radians)
fn rotation_matrix(axis: vec3<f32>, angle: f32) -> mat4x4<f32> {
    let a = normalize(axis);
    let s = sin(angle);
    let c = cos(angle);
    let oc = 1.0 - c;
    return mat4x4<f32>(
        vec4<f32>(oc * a.x * a.x + c,       oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s, 0.0),
        vec4<f32>(oc * a.x * a.y - a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z + a.x * s, 0.0),
        vec4<f32>(oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c,       0.0),
        vec4<f32>(0.0,                      0.0,                      0.0,                      1.0));
}
`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: mat4x4<f32> = rotation_matrix(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Matrix",
  ["rotation", "matrix", "transform", "rotate", "angle", "axis"]
);
