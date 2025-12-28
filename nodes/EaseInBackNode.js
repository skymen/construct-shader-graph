import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const C1 = "1.70158";
const C3 = "2.70158"; // c1 + 1

export const EaseInBackNode = new NodeType(
  "Ease In Back",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#a54a6f",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${C3} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} - ${C1} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${C3} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} - ${C1} * ${inputs[0]} * ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${C3} * ${inputs[0]} * ${inputs[0]} * ${inputs[0]} - ${C1} * ${inputs[0]} * ${inputs[0]};`;
      },
    },
  },
  "Easing",
  [
    "ease",
    "easing",
    "back",
    "overshoot",
    "in",
    "animation",
    "interpolation",
    "anticipation",
  ]
);

EaseInBackNode.manual = {
  description:
    "Applies a back ease-in curve that slightly overshoots before accelerating. Creates an anticipation effect.",
  html: `
    <h4>Formula</h4>
    <pre><code>c1 = 1.70158
c3 = c1 + 1
Result = c3 * T³ - c1 * T²</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Anticipation before movement</li>
      <li>Wind-up animations</li>
      <li>Button press effects</li>
    </ul>
    
    <div class="tip">
      <strong>Note:</strong> Output goes slightly negative before reaching 1, creating an overshoot effect.
    </div>
  `,
};
