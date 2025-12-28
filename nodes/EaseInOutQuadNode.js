import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInOutQuadNode = new NodeType(
  "Ease In Out Quad",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? 2.0 * ${inputs[0]} * ${inputs[0]} : 1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? 2.0 * ${inputs[0]} * ${inputs[0]} : 1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0) / 2.0, 2.0 * ${inputs[0]} * ${inputs[0]}, ${inputs[0]} < 0.5);`;
      },
    },
  },
  "Easing",
  [
    "ease",
    "easing",
    "quad",
    "quadratic",
    "inout",
    "animation",
    "interpolation",
    "power",
  ]
);

EaseInOutQuadNode.manual = {
  description:
    "Applies a quadratic ease-in-out curve to the input. Uses power of 2 for symmetric acceleration and deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>T < 0.5: Result = 2T²
T ≥ 0.5: Result = 1 - (-2T + 2)² / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Complete animation cycles</li>
      <li>Smooth transitions</li>
      <li>UI movements</li>
    </ul>
  `,
};
