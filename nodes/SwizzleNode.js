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

SwizzleNode.manual = {
  description:
    "Rearranges or extracts components from a vector using swizzle notation. Enter a pattern of 1–4 characters from one of the component sets: <code>xyzw</code> (position), <code>rgba</code> (color), or <code>stpq</code> (texture coordinates). You cannot mix component sets. The output type depends on the pattern length (1 char = float, 2 = vec2, 3 = vec3, 4 = vec4).",
  html: `
    <h3>Examples</h3>
    <table class="manual-ports-table">
      <thead><tr><th>Pattern</th><th>Effect</th></tr></thead>
      <tbody>
        <tr><td><code>xy</code></td><td>Extract first two components as vec2</td></tr>
        <tr><td><code>x</code></td><td>Extract the X component as float</td></tr>
        <tr><td><code>zyx</code></td><td>Reverse a vec3</td></tr>
        <tr><td><code>xxxx</code></td><td>Broadcast X to all four components (vec4)</td></tr>
        <tr><td><code>rg</code></td><td>Same as <code>xy</code> using the color set</td></tr>
      </tbody>
    </table>
    <div class="tip">
      <strong>Tip:</strong> Component sets are interchangeable — <code>xy</code>, <code>rg</code>, and <code>st</code> all extract the same two components.
    </div>
  `,
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
