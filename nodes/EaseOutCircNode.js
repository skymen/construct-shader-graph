import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutCircNode = new NodeType(
  "Ease Out Circ",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#4aa58f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sqrt(1.0 - pow(${inputs[0]} - 1.0, 2.0));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sqrt(1.0 - pow(${inputs[0]} - 1.0, 2.0));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = sqrt(1.0 - pow(${inputs[0]} - 1.0, 2.0));`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "circ", "circular", "out", "animation", "interpolation"]
);

EaseOutCircNode.manual = {
  description:
    "Applies a circular ease-out curve to the input. Creates a quarter-circle deceleration effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = √(1 - (T - 1)²)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Circular motion simulation</li>
      <li>Orbital settling</li>
      <li>Smooth deceleration curves</li>
    </ul>
  `,
};

