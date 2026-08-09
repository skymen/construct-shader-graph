import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ToIntNode = new NodeType(
  "To Int",
  [{ name: "Value", type: "T" }],
  [{ name: "Result", type: "int" }],
  NODE_COLORS.colorInt,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const op = node.operation || "floor";
        const inputType = inputTypes[0];

        // Get the value to convert (extract .x for vectors)
        let value = inputs[0];
        if (
          inputType === "vec2" ||
          inputType === "vec3" ||
          inputType === "vec4" ||
          inputType === "color"
        ) {
          value = `${inputs[0]}.x`;
        }

        // For int and bool, no rounding operation needed
        if (inputType === "int") {
          return `    int ${outputs[0]} = ${inputs[0]};`;
        }
        if (inputType === "bool") {
          return `    int ${outputs[0]} = int(${inputs[0]});`;
        }

        // For float and vector components, apply the rounding operation
        if (op === "truncate") {
          return `    int ${outputs[0]} = int(${value});`;
        }
        return `    int ${outputs[0]} = int(${op}(${value}));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const op = node.operation || "floor";
        const inputType = inputTypes[0];

        // Get the value to convert (extract .x for vectors)
        let value = inputs[0];
        if (
          inputType === "vec2" ||
          inputType === "vec3" ||
          inputType === "vec4" ||
          inputType === "color"
        ) {
          value = `${inputs[0]}.x`;
        }

        // For int and bool, no rounding operation needed
        if (inputType === "int") {
          return `    int ${outputs[0]} = ${inputs[0]};`;
        }
        if (inputType === "bool") {
          return `    int ${outputs[0]} = int(${inputs[0]});`;
        }

        // For float and vector components, apply the rounding operation
        if (op === "truncate") {
          return `    int ${outputs[0]} = int(${value});`;
        }
        return `    int ${outputs[0]} = int(${op}(${value}));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const op = node.operation || "floor";
        const inputType = inputTypes[0];

        // Get the value to convert (extract .x for vectors)
        let value = inputs[0];
        if (
          inputType === "vec2" ||
          inputType === "vec3" ||
          inputType === "vec4" ||
          inputType === "color"
        ) {
          value = `${inputs[0]}.x`;
        }

        // For int and bool, no rounding operation needed
        if (inputType === "int") {
          return `    var ${outputs[0]}: i32 = ${inputs[0]};`;
        }
        if (inputType === "bool") {
          return `    var ${outputs[0]}: i32 = i32(${inputs[0]});`;
        }

        // For float and vector components, apply the rounding operation
        if (op === "truncate") {
          return `    var ${outputs[0]}: i32 = i32(${value});`;
        }
        return `    var ${outputs[0]}: i32 = i32(${op}(${value}));`;
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

// Mirrors the execution above: int passes through, bool casts, float rounds by
// the selected operation. Vectors are not folded - the execution takes .x, but
// vector folding is out of scope (see MathNode.foldConstant).
ToIntNode.foldConstant = (node, inputs) => {
  const { value, type } = inputs[0];

  if (type === "int") return Math.trunc(Number(value));
  if (type === "bool") return value ? 1 : 0;
  if (type !== "float") return null;

  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  switch (node.operation || "floor") {
    case "ceil":
      return Math.ceil(n);
    case "truncate":
      return Math.trunc(n);
    case "round":
      // GLSL round() breaks .5 ties to the nearest even value on some drivers,
      // but the common case is exact, and a half-integer loop count is not a
      // thing worth folding. Decline the tie rather than guess.
      return Math.abs(n % 1) === 0.5 ? null : Math.round(n);
    default:
      return Math.floor(n);
  }
};
