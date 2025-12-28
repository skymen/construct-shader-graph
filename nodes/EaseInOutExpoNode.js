import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const EaseInOutExpoNode = new NodeType(
  "Ease In Out Expo",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.easing,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : ${inputs[0]} < 0.5 ? pow(2.0, 20.0 * ${inputs[0]} - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * ${inputs[0]} + 10.0)) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : ${inputs[0]} < 0.5 ? pow(2.0, 20.0 * ${inputs[0]} - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * ${inputs[0]} + 10.0)) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(select(select((2.0 - pow(2.0, -20.0 * ${inputs[0]} + 10.0)) / 2.0, pow(2.0, 20.0 * ${inputs[0]} - 10.0) / 2.0, ${inputs[0]} < 0.5), ${wgslType}(1.0), ${inputs[0]} == 1.0), ${wgslType}(0.0), ${inputs[0]} == 0.0);`;
      },
    },
  },
  "Easing",
  [
    "ease",
    "easing",
    "expo",
    "exponential",
    "inout",
    "animation",
    "interpolation",
  ]
);

EaseInOutExpoNode.manual = {
  description:
    "Applies an exponential ease-in-out curve to the input. Creates a very dramatic acceleration and deceleration effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>T == 0: 0
T == 1: 1
T < 0.5: 2^(20T - 10) / 2
T ≥ 0.5: (2 - 2^(-20T + 10)) / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Dramatic full animations</li>
      <li>Zoom transitions</li>
      <li>Attention-grabbing effects</li>
    </ul>
  `,
};
