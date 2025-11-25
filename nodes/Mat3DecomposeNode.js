import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const Mat3DecomposeNode = new NodeType(
  "Mat3 Decompose",
  [{ name: "Matrix", type: "mat3" }],
  [
    { name: "V0", type: "vec3" },
    { name: "V1", type: "vec3" },
    { name: "V2", type: "vec3" },
  ],
  PORT_TYPES.mat3.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec3 ${outputs[0]} = vec3(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0]);
    vec3 ${outputs[1]} = vec3(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1]);
    vec3 ${outputs[2]} = vec3(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2]);`;
        }
        return `    vec3 ${outputs[0]} = ${inputs[0]}[0];
    vec3 ${outputs[1]} = ${inputs[0]}[1];
    vec3 ${outputs[2]} = ${inputs[0]}[2];`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec3 ${outputs[0]} = vec3(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0]);
    vec3 ${outputs[1]} = vec3(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1]);
    vec3 ${outputs[2]} = vec3(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2]);`;
        }
        return `    vec3 ${outputs[0]} = ${inputs[0]}[0];
    vec3 ${outputs[1]} = ${inputs[0]}[1];
    vec3 ${outputs[2]} = ${inputs[0]}[2];`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]}[0][0], ${inputs[0]}[1][0], ${inputs[0]}[2][0]);
    var ${outputs[1]}: vec3<f32> = vec3<f32>(${inputs[0]}[0][1], ${inputs[0]}[1][1], ${inputs[0]}[2][1]);
    var ${outputs[2]}: vec3<f32> = vec3<f32>(${inputs[0]}[0][2], ${inputs[0]}[1][2], ${inputs[0]}[2][2]);`;
        }
        return `    var ${outputs[0]}: vec3<f32> = ${inputs[0]}[0];
    var ${outputs[1]}: vec3<f32> = ${inputs[0]}[1];
    var ${outputs[2]}: vec3<f32> = ${inputs[0]}[2];`;
      },
    },
  },
  "Matrix",
  ["matrix", "mat3", "decompose", "split", "columns", "rows", "extract", "tbn"]
);

Mat3DecomposeNode.hasOperation = true;
Mat3DecomposeNode.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat3DecomposeNode.defaultOperation = "columns";
