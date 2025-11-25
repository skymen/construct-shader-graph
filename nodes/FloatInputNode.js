import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const FloatInputNode = new NodeType(
  "Float Input",
  [], // No inputs
  [{ name: "Value", type: "float" }],
  PORT_TYPES.float.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    float ${outputs[0]} = ${node.customInput || "0.0"};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    float ${outputs[0]} = ${node.customInput || "0.0"};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) =>
        `    var ${outputs[0]}: f32 = ${node.customInput || "0.0"};`,
    },
  },
  "Value",
  ["float", "number", "constant", "value", "input", "literal", "decimal"]
);

// Manual documentation
FloatInputNode.manual = {
  description:
    "Creates a constant float value that can be used as input to other nodes. Double-click the value field to edit it directly.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Press <kbd>1</kbd> and left-click on the canvas to quickly create a Float Input node.
    </div>
  `,
};

// Add custom input configuration with validation
FloatInputNode.hasCustomInput = true;
FloatInputNode.customInputConfig = {
  label: "Value",
  placeholder: "0.0",
  defaultValue: "0.0",

  validate: (value, node) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: "Value cannot be empty" };
    }

    // Check if it's a valid float number
    const trimmedValue = value.trim();
    const floatPattern = /^-?\d*\.?\d+([eE][+-]?\d+)?$/;

    if (!floatPattern.test(trimmedValue)) {
      return {
        valid: false,
        error: "Must be a valid float (e.g., 1.0, -2.5, 3.14e-2)",
      };
    }

    // Check if the value is finite
    const numValue = parseFloat(trimmedValue);
    if (!isFinite(numValue)) {
      return {
        valid: false,
        error: "Value must be a finite number",
      };
    }

    return { valid: true };
  },
};
