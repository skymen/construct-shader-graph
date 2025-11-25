import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

// Mat2 * Vec2
export const Mat2VectorMultiplyNode = new NodeType(
  "Mat2 × Vec2",
  [
    { name: "Matrix", type: "mat2" },
    { name: "Vector", type: "vec2" },
  ],
  [{ name: "Result", type: "vec2" }],
  PORT_TYPES.mat2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = ${inputs[0]} * ${inputs[1]};`,
    },
  },
  "Matrix",
  ["matrix", "vector", "multiply", "transform", "apply", "mat2"]
);

// Mat3 * Vec3
export const Mat3VectorMultiplyNode = new NodeType(
  "Mat3 × Vec3",
  [
    { name: "Matrix", type: "mat3" },
    { name: "Vector", type: "vec3" },
  ],
  [{ name: "Result", type: "vec3" }],
  PORT_TYPES.mat3.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = ${inputs[0]} * ${inputs[1]};`,
    },
  },
  "Matrix",
  [
    "matrix",
    "vector",
    "multiply",
    "transform",
    "apply",
    "mat3",
    "tbn",
    "normal",
  ]
);

// Mat4 * Vec4
export const Mat4VectorMultiplyNode = new NodeType(
  "Mat4 × Vec4",
  [
    { name: "Matrix", type: "mat4" },
    { name: "Vector", type: "vec4" },
  ],
  [{ name: "Result", type: "vec4" }],
  PORT_TYPES.mat4.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = ${inputs[0]} * ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = ${inputs[0]} * ${inputs[1]};`,
    },
  },
  "Matrix",
  ["matrix", "vector", "multiply", "transform", "apply", "mat4", "projection"]
);
