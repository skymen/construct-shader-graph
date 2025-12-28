import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const MixNode = new NodeType(
  "Mix",
  [
    { name: "A", type: "genType" },
    { name: "B", type: "genType" },
    { name: "T", type: "genType2" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
  },
  "Math",
  ["lerp", "blend", "interpolate"]
);

// Manual entry for documentation
MixNode.manual = {
  description:
    "Linearly interpolates between two values based on a blend factor. When T is 0, the result is A. When T is 1, the result is B. Values in between produce a smooth transition.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = A * (1 - T) + B * T</code></pre>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Crossfading between textures or colors</li>
      <li>Creating smooth transitions and animations</li>
      <li>Blending effects based on masks or gradients</li>
      <li>Interpolating any numeric values over time</li>
    </ul>
    
    <h4>T Value Behavior</h4>
    <ul>
      <li><code>T = 0.0</code> → Returns A (first input)</li>
      <li><code>T = 0.5</code> → Returns average of A and B</li>
      <li><code>T = 1.0</code> → Returns B (second input)</li>
      <li><code>T &lt; 0</code> or <code>T &gt; 1</code> → Extrapolates beyond inputs</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> Use a noise texture or gradient as T to create organic blending between two textures!
    </div>
  `,
};
