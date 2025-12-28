import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInOutCubicNode = new NodeType(
  "Ease In Out Cubic",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? 4.0 * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} : 1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 3.0) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? 4.0 * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} : 1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 3.0) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 3.0) / 2.0, 4.0 * ${inputs[0]} * ${inputs[0]} * ${inputs[0]}, ${inputs[0]} < 0.5);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "cubic", "inout", "animation", "interpolation", "power"]
);

EaseInOutCubicNode.manual = {
  description:
    "Applies a cubic ease-in-out curve to the input. Uses power of 3 for symmetric acceleration and deceleration.",
  html: `
    <h4>Formula</h4>
    <pre><code>T < 0.5: Result = 4T³
T ≥ 0.5: Result = 1 - (-2T + 2)³ / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Smooth complete animations</li>
      <li>More dramatic than quadratic easing</li>
      <li>Polished UI transitions</li>
    </ul>
  `,
};

