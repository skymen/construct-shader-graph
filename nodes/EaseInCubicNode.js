import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInCubicNode = new NodeType(
  "Ease In Cubic",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#6a8fc5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "cubic", "in", "animation", "interpolation", "power"]
);

EaseInCubicNode.manual = {
  description:
    "Applies a cubic ease-in curve to the input. Uses power of 3 for stronger acceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T³</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Stronger acceleration than quadratic</li>
      <li>Dramatic slow starts</li>
      <li>Heavy object motion</li>
    </ul>
  `,
};

