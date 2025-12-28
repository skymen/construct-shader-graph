import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutQuadNode = new NodeType(
  "Ease Out Quad",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#5a7fb5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - (1.0 - ${inputs[0]}) * (1.0 - ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 - (1.0 - ${inputs[0]}) * (1.0 - ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 - (1.0 - ${inputs[0]}) * (1.0 - ${inputs[0]});`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "quad", "quadratic", "out", "animation", "interpolation", "power"]
);

EaseOutQuadNode.manual = {
  description:
    "Applies a quadratic ease-out curve to the input. Uses power of 2 for deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = 1 - (1 - T)²</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Decelerating animations</li>
      <li>Smooth landings</li>
      <li>Natural stops</li>
    </ul>
  `,
};

