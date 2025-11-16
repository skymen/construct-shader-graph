import { NodeType } from "./NodeType.js";

export const ToIntNode = new NodeType(
  "To Int",
  [{ name: "Value", type: "float" }],
  [{ name: "Result", type: "int" }],
  "#3a4a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || "floor";
        if (op === "truncate") {
          return `    int ${outputs[0]} = int(${inputs[0]});`;
        }
        return `    int ${outputs[0]} = int(${op}(${inputs[0]}));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || "floor";
        if (op === "truncate") {
          return `    int ${outputs[0]} = int(${inputs[0]});`;
        }
        return `    int ${outputs[0]} = int(${op}(${inputs[0]}));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const op = node.operation || "floor";
        if (op === "truncate") {
          return `    var ${outputs[0]}: i32 = i32(${inputs[0]});`;
        }
        return `    var ${outputs[0]}: i32 = i32(${op}(${inputs[0]}));`;
      },
    },
  },
  "Conversion",
  ["cast", "convert", "float to int", "type"]
);

// Add operation options to the node type
ToIntNode.hasOperation = true;
ToIntNode.operationOptions = [
  { value: "floor", label: "Floor" },
  { value: "ceil", label: "Ceil" },
  { value: "truncate", label: "Truncate" },
  { value: "round", label: "Round" },
];
