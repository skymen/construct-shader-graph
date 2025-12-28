import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const PI = "3.14159265359";

export const EaseInSineNode = new NodeType(
  "Ease In Sine",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff6b35",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - cos((${inputs[0]} * ${PI}) / 2.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - cos((${inputs[0]} * ${PI}) / 2.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - cos((${inputs[0]} * ${PI}) / 2.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "sine", "in", "animation", "interpolation", "smooth"]
);

EaseInSineNode.manual = {
  description:
    "Applies a sine-based ease-in curve to the input. Starts slow and accelerates toward the end.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - cos((T * π) / 2)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Smooth animation starts</li>
      <li>Gentle acceleration effects</li>
      <li>Natural-feeling transitions</li>
    </ul>
  `,
};

