import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInQuartNode = new NodeType(
  "Ease In Quart",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "quart", "quartic", "in", "animation", "interpolation", "power"]
);

EaseInQuartNode.manual = {
  description:
    "Applies a quartic ease-in curve to the input. Uses power of 4 for aggressive acceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T⁴</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Aggressive acceleration</li>
      <li>Very slow starts</li>
      <li>Dramatic reveal animations</li>
    </ul>
  `,
};

