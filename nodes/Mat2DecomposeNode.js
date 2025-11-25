import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const Mat2DecomposeNode = new NodeType(
  "Mat2 Decompose",
  [{ name: "Matrix", type: "mat2" }],
  [
    { name: "V0", type: "vec2" },
    { name: "V1", type: "vec2" },
  ],
  PORT_TYPES.mat2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec2 ${outputs[0]} = vec2(${inputs[0]}[0][0], ${inputs[0]}[1][0]);
    vec2 ${outputs[1]} = vec2(${inputs[0]}[0][1], ${inputs[0]}[1][1]);`;
        }
        return `    vec2 ${outputs[0]} = ${inputs[0]}[0];
    vec2 ${outputs[1]} = ${inputs[0]}[1];`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    vec2 ${outputs[0]} = vec2(${inputs[0]}[0][0], ${inputs[0]}[1][0]);
    vec2 ${outputs[1]} = vec2(${inputs[0]}[0][1], ${inputs[0]}[1][1]);`;
        }
        return `    vec2 ${outputs[0]} = ${inputs[0]}[0];
    vec2 ${outputs[1]} = ${inputs[0]}[1];`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]}[0][0], ${inputs[0]}[1][0]);
    var ${outputs[1]}: vec2<f32> = vec2<f32>(${inputs[0]}[0][1], ${inputs[0]}[1][1]);`;
        }
        return `    var ${outputs[0]}: vec2<f32> = ${inputs[0]}[0];
    var ${outputs[1]}: vec2<f32> = ${inputs[0]}[1];`;
      },
    },
  },
  "Matrix",
  ["matrix", "mat2", "decompose", "split", "columns", "rows", "extract"]
);

Mat2DecomposeNode.hasOperation = true;
Mat2DecomposeNode.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat2DecomposeNode.defaultOperation = "columns";
