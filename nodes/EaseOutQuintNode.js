import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutQuintNode = new NodeType(
  "Ease Out Quint",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#8aafe5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 5.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - pow(1.0 - ${inputs[0]}, 5.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - pow(1.0 - ${inputs[0]}, 5.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "quint", "quintic", "out", "animation", "interpolation", "power"]
);

EaseOutQuintNode.manual = {
  description:
    "Applies a quintic ease-out curve to the input. Uses power of 5 for very aggressive deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - (1 - T)⁵</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Very aggressive deceleration</li>
      <li>Fast initial movement</li>
      <li>Dramatic stops</li>
    </ul>
  `,
};

