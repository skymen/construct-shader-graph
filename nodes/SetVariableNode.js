import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const SetVariableNode = new NodeType(
  "Set Variable",
  [{ name: "Value", type: "T" }],
  [],
  "#9b59b6", // Purple color for variable nodes
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const varName = `temp_${node.customInput || "variable"}`;
        const type = inputTypes[0];
        return `    ${type} ${varName} = ${inputs[0]};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const varName = `temp_${node.customInput || "variable"}`;
        const type = inputTypes[0];
        return `    ${type} ${varName} = ${inputs[0]};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const varName = `temp_${node.customInput || "variable"}`;
        const type = inputTypes[0];
        // Convert type to WGSL format
        const wgslType = toWGSLType(type);
        return `    var ${varName}: ${wgslType} = ${inputs[0]};`;
      },
    },
  },
  "Variables",
  ["variable", "set", "store", "define"]
);

// Add custom input configuration for variable name
SetVariableNode.hasCustomInput = true;
SetVariableNode.customInputConfig = {
  label: "Variable Name",
  placeholder: "myVariable",
  defaultValue: "myVariable",

  validate: (value, node) => {
    if (!value || value.length === 0) {
      return { valid: false, error: "Variable name cannot be empty" };
    }

    // Check if it's a valid identifier (starts with letter or underscore, contains only alphanumeric and underscore)
    const validIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validIdentifier.test(value)) {
      return {
        valid: false,
        error:
          "Variable name must be a valid identifier (letters, numbers, underscore)",
      };
    }

    // Check for duplicate variable names (excluding this node)
    if (node && node._blueprintSystem) {
      const existingVariable = node._blueprintSystem.nodes.find(
        (n) =>
          n.nodeType.name === "Set Variable" &&
          n.id !== node.id &&
          n.customInput === value
      );

      if (existingVariable) {
        return {
          valid: false,
          error: `Variable name "${value}" is already in use`,
        };
      }
    }

    // Check for reserved keywords
    const tempValue = `temp_${value}`;
    const reservedKeywords = [
      "if",
      "else",
      "for",
      "while",
      "do",
      "return",
      "break",
      "continue",
      "float",
      "int",
      "bool",
      "vec2",
      "vec3",
      "vec4",
      "mat2",
      "mat3",
      "mat4",
      "void",
      "main",
      "true",
      "false",
      "uniform",
      "varying",
      "attribute",
      "const",
      "in",
      "out",
      "inout",
      "struct",
      "discard",
    ];

    if (reservedKeywords.includes(tempValue.toLowerCase())) {
      return {
        valid: false,
        error: "Variable name cannot be a reserved keyword",
      };
    }

    return { valid: true };
  },
};
