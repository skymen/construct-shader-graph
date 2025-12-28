import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutCubicNode = new NodeType(
  "Ease Out Cubic",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#6a8fc5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 3.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 3.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - pow(1.0 - ${inputs[0]}, 3.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "cubic", "out", "animation", "interpolation", "power"]
);

EaseOutCubicNode.manual = {
  description:
    "Applies a cubic ease-out curve to the input. Uses power of 3 for stronger deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - (1 - T)³</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Stronger deceleration than quadratic</li>
      <li>Dramatic stops</li>
      <li>Heavy object landing</li>
    </ul>
  `,
};

