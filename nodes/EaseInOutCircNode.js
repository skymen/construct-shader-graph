import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInOutCircNode = new NodeType(
  "Ease In Out Circ",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#4aa58f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? (1.0 - sqrt(1.0 - pow(2.0 * ${inputs[0]}, 2.0))) / 2.0 : (sqrt(1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0)) + 1.0) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? (1.0 - sqrt(1.0 - pow(2.0 * ${inputs[0]}, 2.0))) / 2.0 : (sqrt(1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0)) + 1.0) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select((sqrt(1.0 - pow(-2.0 * ${inputs[0]} + 2.0, 2.0)) + 1.0) / 2.0, (1.0 - sqrt(1.0 - pow(2.0 * ${inputs[0]}, 2.0))) / 2.0, ${inputs[0]} < 0.5);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "circ", "circular", "inout", "animation", "interpolation"]
);

EaseInOutCircNode.manual = {
  description:
    "Applies a circular ease-in-out curve to the input. Creates a half-circle transition effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>T < 0.5: (1 - √(1 - (2T)²)) / 2
T ≥ 0.5: (√(1 - (-2T + 2)²) + 1) / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Circular motion transitions</li>
      <li>Orbital path animations</li>
      <li>Smooth full transitions</li>
    </ul>
  `,
};

