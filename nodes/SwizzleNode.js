import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import { toWGSLType } from "./PortTypes.js";

export const SwizzleNode = new NodeType(
  "Swizzle",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "custom" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const pattern = node.customInput || "xyz";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]}.${pattern};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const pattern = node.customInput || "xyz";
        return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]}.${pattern};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const pattern = node.customInput || "xyz";
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]}.${pattern};`;
      },
    },
  },
  "Vector",
  ["swizzle", "component", "extract", "shuffle", "xyzw", "rgba", "stpq"]
);

// Add custom input configuration
SwizzleNode.hasCustomInput = true;
SwizzleNode.customInputConfig = {
  label: "Pattern",
  placeholder: "xyz",
  defaultValue: "xyz",

  // Validation function that takes the typed value and node data
  validate: (value, node) => {
    if (!value || value.length === 0) {
      return { valid: false, error: "Pattern cannot be empty" };
    }

    if (value.length > 4) {
      return {
        valid: false,
        error: "Pattern cannot be longer than 4 characters",
      };
    }

    // Check if all characters are valid swizzle components
    const validXYZW = /^[xyzw]+$/;
    const validRGBA = /^[rgba]+$/;
    const validSTPQ = /^[stpq]+$/;

    if (
      !validXYZW.test(value) &&
      !validRGBA.test(value) &&
      !validSTPQ.test(value)
    ) {
      return {
        valid: false,
        error:
          "Pattern must use only xyzw, rgba, or stpq components (don't mix)",
      };
    }

    // Check for mixed component sets (e.g., can't mix x and r)
    const hasXYZW = /[xyzw]/.test(value);
    const hasRGBA = /[rgba]/.test(value);
    const hasSTPQ = /[stpq]/.test(value);

    const setCount = [hasXYZW, hasRGBA, hasSTPQ].filter(Boolean).length;
    if (setCount > 1) {
      return {
        valid: false,
        error: "Cannot mix component sets (xyzw/rgba/stpq)",
      };
    }

    return { valid: true };
  },
};

// Function to determine output type based on custom input
SwizzleNode.getCustomType = (node, port) => {
  // Only the output port has custom type
  if (port.type !== "output") return port.portType;

  const pattern = node.customInput || "xyz";
  const length = pattern.length;

  switch (length) {
    case 1:
      return "float";
    case 2:
      return "vec2";
    case 3:
      return "vec3";
    case 4:
      return "vec4";
    default:
      return "float";
  }
};
