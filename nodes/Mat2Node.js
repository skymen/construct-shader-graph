import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Mat2Node = new NodeType(
  "Mat2",
  [
    { name: "V0", type: "vec2" },
    { name: "V1", type: "vec2" },
  ],
  [{ name: "Matrix", type: "mat2" }],
  NODE_COLORS.colorMat2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          // Rows: transpose the result (input vectors become rows)
          return `    mat2 ${outputs[0]} = mat2(${inputs[0]}.x, ${inputs[1]}.x, ${inputs[0]}.y, ${inputs[1]}.y);`;
        }
        return `    mat2 ${outputs[0]} = mat2(${inputs[0]}, ${inputs[1]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    mat2 ${outputs[0]} = mat2(${inputs[0]}.x, ${inputs[1]}.x, ${inputs[0]}.y, ${inputs[1]}.y);`;
        }
        return `    mat2 ${outputs[0]} = mat2(${inputs[0]}, ${inputs[1]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const isRows = node.operation === "rows";
        if (isRows) {
          return `    var ${outputs[0]}: mat2x2<f32> = mat2x2<f32>(vec2<f32>(${inputs[0]}.x, ${inputs[1]}.x), vec2<f32>(${inputs[0]}.y, ${inputs[1]}.y));`;
        }
        return `    var ${outputs[0]}: mat2x2<f32> = mat2x2<f32>(${inputs[0]}, ${inputs[1]});`;
      },
    },
  },
  "Matrix",
  ["matrix", "mat2", "2x2", "compose", "construct", "columns", "rows"]
);

Mat2Node.hasOperation = true;
Mat2Node.operationOptions = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
Mat2Node.defaultOperation = "columns";
