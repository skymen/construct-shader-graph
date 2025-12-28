import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const C1 = "1.70158";
const C2 = "2.5949095"; // c1 * 1.525

export const EaseInOutBackNode = new NodeType(
  "Ease In Out Back",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? (pow(2.0 * ${inputs[0]}, 2.0) * ((${C2} + 1.0) * 2.0 * ${inputs[0]} - ${C2})) / 2.0 : (pow(2.0 * ${inputs[0]} - 2.0, 2.0) * ((${C2} + 1.0) * (${inputs[0]} * 2.0 - 2.0) + ${C2}) + 2.0) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} < 0.5 ? (pow(2.0 * ${inputs[0]}, 2.0) * ((${C2} + 1.0) * 2.0 * ${inputs[0]} - ${C2})) / 2.0 : (pow(2.0 * ${inputs[0]} - 2.0, 2.0) * ((${C2} + 1.0) * (${inputs[0]} * 2.0 - 2.0) + ${C2}) + 2.0) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = select((pow(2.0 * ${inputs[0]} - 2.0, 2.0) * ((${C2} + 1.0) * (${inputs[0]} * 2.0 - 2.0) + ${C2}) + 2.0) / 2.0, (pow(2.0 * ${inputs[0]}, 2.0) * ((${C2} + 1.0) * 2.0 * ${inputs[0]} - ${C2})) / 2.0, ${inputs[0]} < 0.5);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "back", "overshoot", "inout", "animation", "interpolation"]
);

EaseInOutBackNode.manual = {
  description:
    "Applies a back ease-in-out curve with overshoot at both ends. Creates anticipation and follow-through.",
  html: `
    <h4>Formula</h4>
    <pre><code>c2 = c1 * 1.525
T < 0.5: ((2T)² * ((c2+1) * 2T - c2)) / 2
T ≥ 0.5: ((2T-2)² * ((c2+1) * (2T-2) + c2) + 2) / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Full animation with character</li>
      <li>Wind-up and overshoot effects</li>
      <li>Playful UI animations</li>
    </ul>
  `,
};

