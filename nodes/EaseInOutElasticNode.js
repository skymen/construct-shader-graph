import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const PI = "3.14159265359";
const C5 = "1.3962634"; // (2 * PI) / 4.5

export const EaseInOutElasticNode = new NodeType(
  "Ease In Out Elastic",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#6f4aa5",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : ${inputs[0]} < 0.5 ? -(pow(2.0, 20.0 * ${inputs[0]} - 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0 : (pow(2.0, -20.0 * ${inputs[0]} + 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0 + 1.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} == 0.0 ? 0.0 : ${inputs[0]} == 1.0 ? 1.0 : ${inputs[0]} < 0.5 ? -(pow(2.0, 20.0 * ${inputs[0]} - 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0 : (pow(2.0, -20.0 * ${inputs[0]} + 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0 + 1.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select(select(select((pow(2.0, -20.0 * ${inputs[0]} + 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0 + 1.0, -(pow(2.0, 20.0 * ${inputs[0]} - 10.0) * sin((20.0 * ${inputs[0]} - 11.125) * ${C5})) / 2.0, ${inputs[0]} < 0.5), ${wgslType}(1.0), ${inputs[0]} == 1.0), ${wgslType}(0.0), ${inputs[0]} == 0.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "elastic", "spring", "inout", "animation", "interpolation", "bounce"]
);

EaseInOutElasticNode.manual = {
  description:
    "Applies an elastic ease-in-out curve that creates a spring-like oscillation effect at both ends.",
  html: `
    <h4>Formula</h4>
    <pre><code>c5 = (2π) / 4.5
T == 0: 0
T == 1: 1
T < 0.5: -(2^(20T-10) * sin((20T - 11.125) * c5)) / 2
T ≥ 0.5: (2^(-20T+10) * sin((20T - 11.125) * c5)) / 2 + 1</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Full spring animations</li>
      <li>Wobbly transitions</li>
      <li>Playful, bouncy UI</li>
    </ul>
  `,
};

