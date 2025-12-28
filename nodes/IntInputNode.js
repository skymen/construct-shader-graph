import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const IntInputNode = new NodeType(
  "Int Input",
  [], // No inputs
  [{ name: "Value", type: "int" }],
  NODE_COLORS.colorInt,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    int ${outputs[0]} = ${node.customInput || "0"};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    int ${outputs[0]} = ${node.customInput || "0"};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    var ${outputs[0]}: i32 = ${node.customInput || "0"};`,
    },
  },
  "Value",
  ["int", "integer", "number", "constant", "value", "input", "literal"]
);

// Add custom input configuration with validation
IntInputNode.hasCustomInput = true;
IntInputNode.customInputConfig = {
  label: "Value",
  placeholder: "0",
  defaultValue: "0",

  validate: (value, node) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: "Value cannot be empty" };
    }

    // Check if it's a valid integer
    const trimmedValue = value.trim();
    const intPattern = /^-?\d+$/;

    if (!intPattern.test(trimmedValue)) {
      return {
        valid: false,
        error: "Must be a valid integer (e.g., 0, 42, -10)",
      };
    }

    // Check if the value is within safe integer range
    const numValue = parseInt(trimmedValue, 10);
    if (!Number.isSafeInteger(numValue)) {
      return {
        valid: false,
        error: "Value must be within safe integer range",
      };
    }

    return { valid: true };
  },
};
