import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseOutExpoNode = new NodeType(
  "Ease Out Expo",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * ${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * ${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(1.0 - pow(2.0, -10.0 * ${inputs[0]}), ${wgslType}(1.0), ${inputs[0]} == 1.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "expo", "exponential", "out", "animation", "interpolation"]
);

EaseOutExpoNode.manual = {
  description:
    "Applies an exponential ease-out curve to the input. Creates a very dramatic deceleration effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T == 1 ? 1 : 1 - 2^(-10T)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Rapid initial movement</li>
      <li>Zoom-out effects</li>
      <li>Dramatic settling</li>
    </ul>
  `,
};

