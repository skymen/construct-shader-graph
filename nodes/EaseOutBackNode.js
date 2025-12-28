import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const C1 = "1.70158";
const C3 = "2.70158"; // c1 + 1

export const EaseOutBackNode = new NodeType(
  "Ease Out Back",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#a54a6f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 + ${C3} * pow(${inputs[0]} - 1.0, 3.0) + ${C1} * pow(${inputs[0]} - 1.0, 2.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = 1.0 + ${C3} * pow(${inputs[0]} - 1.0, 3.0) + ${C1} * pow(${inputs[0]} - 1.0, 2.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = 1.0 + ${C3} * pow(${inputs[0]} - 1.0, 3.0) + ${C1} * pow(${inputs[0]} - 1.0, 2.0);`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "back", "overshoot", "out", "animation", "interpolation", "bounce"]
);

EaseOutBackNode.manual = {
  description:
    "Applies a back ease-out curve that overshoots before settling. Creates a bounce-back effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>c1 = 1.70158
c3 = c1 + 1
Result = 1 + c3 * (T - 1)³ + c1 * (T - 1)²</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Overshoot and settle animations</li>
      <li>Pop-in effects</li>
      <li>Elastic landing feel</li>
    </ul>
    
    <div class="tip">
      <strong>Note:</strong> Output goes slightly above 1 before settling, creating an overshoot effect.
    </div>
  `,
};

