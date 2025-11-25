import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const Mat3Node = new NodeType(
  "Mat3",
  [
    { name: "V0", type: "vec3" },
    { name: "V1", type: "vec3" },
    { name: "V2", type: "vec3" },
  ],
  [{ name: "Matrix", type: "mat3" }],
  PORT_TYPES.mat3.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          // Rows: transpose the result (input vectors become rows)
          return `    mat3 ${outputs[0]} = mat3(
        ${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x,
        ${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y,
        ${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z);`;
        }
        return `    mat3 ${outputs[0]} = mat3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    mat3 ${outputs[0]} = mat3(
        ${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x,
        ${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y,
        ${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z);`;
        }
        return `    mat3 ${outputs[0]} = mat3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: mat3x3<f32> = mat3x3<f32>(
        vec3<f32>(${inputs[0]}.x, ${inputs[1]}.x, ${inputs[2]}.x),
        vec3<f32>(${inputs[0]}.y, ${inputs[1]}.y, ${inputs[2]}.y),
        vec3<f32>(${inputs[0]}.z, ${inputs[1]}.z, ${inputs[2]}.z));`;
        }
        return `    var ${outputs[0]}: mat3x3<f32> = mat3x3<f32>(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
  },
  "Matrix",
  [
    "matrix",
    "mat3",
    "3x3",
    "compose",
    "construct",
    "columns",
    "rows",
    "tbn",
    "normal",
  ]
);

Mat3Node.hasOperation = true;
Mat3Node.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat3Node.defaultOperation = "columns";
