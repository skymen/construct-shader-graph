import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInQuintNode = new NodeType(
  "Ease In Quint",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#8aafe5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]};`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "quint", "quintic", "in", "animation", "interpolation", "power"]
);

EaseInQuintNode.manual = {
  description:
    "Applies a quintic ease-in curve to the input. Uses power of 5 for very aggressive acceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T⁵</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Very aggressive acceleration</li>
      <li>Extremely slow starts</li>
      <li>Dramatic emphasis on final moments</li>
    </ul>
  `,
};

