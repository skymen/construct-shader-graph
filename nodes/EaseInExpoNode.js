import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import { toWGSLType } from "./PortTypes.js";

export const EaseInExpoNode = new NodeType(
  "Ease In Expo",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.easing,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : pow(2.0, 10.0 * ${inputs[0]} - 10.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : pow(2.0, 10.0 * ${inputs[0]} - 10.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(pow(2.0, 10.0 * ${inputs[0]} - 10.0), ${wgslType}(0.0), ${inputs[0]} == 0.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "expo", "exponential", "in", "animation", "interpolation"]
);

EaseInExpoNode.manual = {
  description:
    "Applies an exponential ease-in curve to the input. Creates a very dramatic acceleration effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = T == 0 ? 0 : 2^(10T - 10)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Explosive acceleration</li>
      <li>Zoom-in effects</li>
      <li>Dramatic reveals</li>
    </ul>
  `,
};

