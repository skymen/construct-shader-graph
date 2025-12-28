import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const SmoothstepNode = new NodeType(
  "Smoothstep",
  [
    { name: "Edge0", type: "genType" },
    { name: "Edge1", type: "genType" },
    { name: "Value", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.comparison,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
  },
  "Math",
  ["smooth", "interpolate", "hermite"]
);

// Manual entry for documentation
SmoothstepNode.manual = {
  description:
    "Performs smooth Hermite interpolation between 0 and 1 when the input is between Edge0 and Edge1. Returns 0 if less than Edge0, 1 if greater than Edge1, with a smooth S-curve transition between.",
  html: `
    <h4>How it Works</h4>
    <pre><code>t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
result = t * t * (3 - 2 * t)</code></pre>
    
    <h4>Behavior</h4>
    <ul>
      <li>Value ≤ Edge0 → Returns 0</li>
      <li>Value ≥ Edge1 → Returns 1</li>
      <li>Edge0 < Value < Edge1 → Smooth interpolation</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Creating soft transitions and gradients</li>
      <li>Anti-aliasing procedural patterns</li>
      <li>Thresholding with smooth edges</li>
      <li>Creating vignettes and falloffs</li>
      <li>Easing animations and color transitions</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> Use smoothstep instead of step when you want soft edges. For example, use it to create glowing outlines or soft masks!
    </div>
  `,
};
