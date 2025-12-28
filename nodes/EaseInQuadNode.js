import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const EaseInQuadNode = new NodeType(
  "Ease In Quad",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.easing,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} * ${inputs[0]};`;
      },
    },
  },
  "Easing",
  [
    "ease",
    "easing",
    "quad",
    "quadratic",
    "in",
    "animation",
    "interpolation",
    "power",
  ]
);

EaseInQuadNode.manual = {
  description:
    "Applies a quadratic ease-in curve to the input. Uses power of 2 for acceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T²</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Accelerating animations</li>
      <li>Gravity-like motion</li>
      <li>Smooth starts</li>
    </ul>
  `,
};
