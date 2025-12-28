import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Mat4Node = new NodeType(
  "Mat4",
  [
    { name: "V0", type: "vec4" },
    { name: "V1", type: "vec4" },
    { name: "V2", type: "vec4" },
    { name: "V3", type: "vec4" },
  ],
  [{ name: "Matrix", type: "mat4" }],
  NODE_COLORS.colorMat4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          // Rows: transpose the result (input vectors become rows)
          return `    mat4 ${outputs[0]} = mat4(
        ${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x, ${inputs[3]}.x,
        ${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y, ${inputs[3]}.y,
        ${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z, ${inputs[3]}.z,
        ${inputs[0]}.w, ${inputs[1]}.w, ${inputs[2]}.w, ${inputs[3]}.w);`;
        }
        return `    mat4 ${outputs[0]} = mat4(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    mat4 ${outputs[0]} = mat4(
        ${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x, ${inputs[3]}.x,
        ${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y, ${inputs[3]}.y,
        ${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z, ${inputs[3]}.z,
        ${inputs[0]}.w, ${inputs[1]}.w, ${inputs[2]}.w, ${inputs[3]}.w);`;
        }
        return `    mat4 ${outputs[0]} = mat4(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: mat4x4<f32> = mat4x4<f32>(
        vec4<f32>(${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x, ${inputs[3]}.x),
        vec4<f32>(${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y, ${inputs[3]}.y),
        vec4<f32>(${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z, ${inputs[3]}.z),
        vec4<f32>(${inputs[0]}.w, ${inputs[1]}.w, ${inputs[2]}.w, ${inputs[3]}.w));`;
        }
        return `    var ${outputs[0]}: mat4x4<f32> = mat4x4<f32>(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`;
      },
    },
  },
  "Matrix",
  [
    "matrix",
    "mat4",
    "4x4",
    "compose",
    "construct",
    "columns",
    "rows",
    "transform",
    "projection",
  ]
);

Mat4Node.hasOperation = true;
Mat4Node.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat4Node.defaultOperation = "columns";
