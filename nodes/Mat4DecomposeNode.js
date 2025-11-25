import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const Mat4DecomposeNode = new NodeType(
  "Mat4 Decompose",
  [{ name: "Matrix", type: "mat4" }],
  [
    { name: "V0", type: "vec4" },
    { name: "V1", type: "vec4" },
    { name: "V2", type: "vec4" },
    { name: "V3", type: "vec4" },
  ],
  PORT_TYPES.mat4.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec4 ${outputs[0]} = vec4(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0], ${inputs[0]}[3][0]);
    vec4 ${outputs[1]} = vec4(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1], ${inputs[0]}[3][1]);
    vec4 ${outputs[2]} = vec4(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2], ${inputs[0]}[3][2]);
    vec4 ${outputs[3]} = vec4(${inputs[0]}[0][3], ${inputs[0]}[1][3], ${inputs[0]}[2][3], ${inputs[0]}[3][3]);`;
        }
        return `    vec4 ${outputs[0]} = ${inputs[0]}[0];
    vec4 ${outputs[1]} = ${inputs[0]}[1];
    vec4 ${outputs[2]} = ${inputs[0]}[2];
    vec4 ${outputs[3]} = ${inputs[0]}[3];`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec4 ${outputs[0]} = vec4(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0], ${inputs[0]}[3][0]);
    vec4 ${outputs[1]} = vec4(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1], ${inputs[0]}[3][1]);
    vec4 ${outputs[2]} = vec4(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2], ${inputs[0]}[3][2]);
    vec4 ${outputs[3]} = vec4(${inputs[0]}[0][3], ${inputs[0]}[1][3], ${inputs[0]}[2][3], ${inputs[0]}[3][3]);`;
        }
        return `    vec4 ${outputs[0]} = ${inputs[0]}[0];
    vec4 ${outputs[1]} = ${inputs[0]}[1];
    vec4 ${outputs[2]} = ${inputs[0]}[2];
    vec4 ${outputs[3]} = ${inputs[0]}[3];`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0], ${inputs[0]}[3][0]);
    var ${outputs[1]}: vec4<f32> = vec4<f32>(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1], ${inputs[0]}[3][1]);
    var ${outputs[2]}: vec4<f32> = vec4<f32>(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2], ${inputs[0]}[3][2]);
    var ${outputs[3]}: vec4<f32> = vec4<f32>(${inputs[0]}[0][3], ${inputs[0]}[1][3], ${inputs[0]}[2][3], ${inputs[0]}[3][3]);`;
        }
        return `    var ${outputs[0]}: vec4<f32> = ${inputs[0]}[0];
    var ${outputs[1]}: vec4<f32> = ${inputs[0]}[1];
    var ${outputs[2]}: vec4<f32> = ${inputs[0]}[2];
    var ${outputs[3]}: vec4<f32> = ${inputs[0]}[3];`;
      },
    },
  },
  "Matrix",
  [
    "matrix",
    "mat4",
    "decompose",
    "split",
    "columns",
    "rows",
    "extract",
    "transform",
  ]
);

Mat4DecomposeNode.hasOperation = true;
Mat4DecomposeNode.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat4DecomposeNode.defaultOperation = "columns";
