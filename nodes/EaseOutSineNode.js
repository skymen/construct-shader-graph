import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const PI = "3.14159265359";

export const EaseOutSineNode = new NodeType(
  "Ease Out Sine",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#4a6fa5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sin((${inputs[0]} * ${PI}) / 2.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = sin((${inputs[0]} * ${PI}) / 2.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = sin((${inputs[0]} * ${PI}) / 2.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "sine", "out", "animation", "interpolation", "smooth"]
);

EaseOutSineNode.manual = {
  description:
    "Applies a sine-based ease-out curve to the input. Starts fast and decelerates toward the end.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = sin((T * π) / 2)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Smooth animation endings</li>
      <li>Gentle deceleration effects</li>
      <li>Natural-feeling transitions</li>
    </ul>
  `,
};

