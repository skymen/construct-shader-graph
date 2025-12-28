import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInCircNode = new NodeType(
  "Ease In Circ",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#4aa58f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - sqrt(1.0 - pow(${inputs[0]}, 2.0));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - sqrt(1.0 - pow(${inputs[0]}, 2.0));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - sqrt(1.0 - pow(${inputs[0]}, 2.0));`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "circ", "circular", "in", "animation", "interpolation"]
);

EaseInCircNode.manual = {
  description:
    "Applies a circular ease-in curve to the input. Creates a quarter-circle acceleration effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - √(1 - T²)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Circular motion simulation</li>
      <li>Orbital animations</li>
      <li>Smooth acceleration curves</li>
    </ul>
  `,
};

