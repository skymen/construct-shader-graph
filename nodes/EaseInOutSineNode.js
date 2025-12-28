import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

const PI = "3.14159265359";

export const EaseInOutSineNode = new NodeType(
  "Ease In Out Sine",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.easing,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = -(cos(${PI} * ${inputs[0]}) - 1.0) / 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = -(cos(${PI} * ${inputs[0]}) - 1.0) / 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = -(cos(${PI} * ${inputs[0]}) - 1.0) / 2.0;`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "sine", "inout", "animation", "interpolation", "smooth"]
);

EaseInOutSineNode.manual = {
  description:
    "Applies a sine-based ease-in-out curve to the input. Starts slow, speeds up in the middle, then slows down at the end.",
  html: `
    <h4>Formula</h4>
    <pre><code>Result = -(cos(π * T) - 1) / 2</code></pre>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Smooth complete animations</li>
      <li>Natural-feeling transitions</li>
      <li>UI element movements</li>
    </ul>
  `,
};
