import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutQuartNode = new NodeType(
  "Ease Out Quart",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#7a9fd5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 4.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 4.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - pow(1.0 - ${inputs[0]}, 4.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "quart", "quartic", "out", "animation", "interpolation", "power"]
);

EaseOutQuartNode.manual = {
  description:
    "Applies a quartic ease-out curve to the input. Uses power of 4 for aggressive deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - (1 - T)⁴</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Aggressive deceleration</li>
      <li>Quick stops</li>
      <li>Snap-to animations</li>
    </ul>
  `,
};

