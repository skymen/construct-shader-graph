import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const PI = "3.14159265359";
const C4 = "2.0943951"; // (2 * PI) / 3

export const EaseInElasticNode = new NodeType(
  "Ease In Elastic",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#6f4aa5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : -pow(2.0, 10.0 * ${inputs[0]} - 10.0) * sin((${inputs[0]} * 10.0 - 10.75) * ${C4});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : -pow(2.0, 10.0 * ${inputs[0]} - 10.0) * sin((${inputs[0]} * 10.0 - 10.75) * ${C4});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(select(-pow(2.0, 10.0 * ${inputs[0]} - 10.0) * sin((${inputs[0]} * 10.0 - 10.75) * ${C4}), ${wgslType}(1.0), ${inputs[0]} == 1.0), ${wgslType}(0.0), ${inputs[0]} == 0.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "elastic", "spring", "in", "animation", "interpolation", "bounce"]
);

EaseInElasticNode.manual = {
  description:
    "Applies an elastic ease-in curve that creates a spring-like oscillation effect before accelerating.",
  html: `
    <h4>Formula</h4>
    <pre><code>c4 = (2π) / 3
T == 0: 0
T == 1: 1
else: -2^(10T-10) * sin((10T - 10.75) * c4)</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Spring-like anticipation</li>
      <li>Wobbly start animations</li>
      <li>Playful UI elements</li>
    </ul>
    
    <div class="tip">
      <strong>Note:</strong> Output oscillates around 0 before reaching 1, creating a spring effect.
    </div>
  `,
};

