import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const N1 = "7.5625";
const D1 = "2.75";

// Bounce out is the base function, bounce in is derived from it
export const EaseOutBounceNode = new NodeType(
  "Ease Out Bounce",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: `
float easeOutBounce(float x) {
    float n1 = ${N1};
    float d1 = ${D1};
    if (x < 1.0 / d1) {
        return n1 * x * x;
    } else if (x < 2.0 / d1) {
        x -= 1.5 / d1;
        return n1 * x * x + 0.75;
    } else if (x < 2.5 / d1) {
        x -= 2.25 / d1;
        return n1 * x * x + 0.9375;
    } else {
        x -= 2.625 / d1;
        return n1 * x * x + 0.984375;
    }
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeOutBounce(${inputs[0]});`,
    },
    webgl2: {
      dependency: `
float easeOutBounce(float x) {
    float n1 = ${N1};
    float d1 = ${D1};
    if (x < 1.0 / d1) {
        return n1 * x * x;
    } else if (x < 2.0 / d1) {
        x -= 1.5 / d1;
        return n1 * x * x + 0.75;
    } else if (x < 2.5 / d1) {
        x -= 2.25 / d1;
        return n1 * x * x + 0.9375;
    } else {
        x -= 2.625 / d1;
        return n1 * x * x + 0.984375;
    }
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeOutBounce(${inputs[0]});`,
    },
    webgpu: {
      dependency: `
fn easeOutBounce(x_in: f32) -> f32 {
    let n1: f32 = ${N1};
    let d1: f32 = ${D1};
    var x: f32 = x_in;
    if (x < 1.0 / d1) {
        return n1 * x * x;
    } else if (x < 2.0 / d1) {
        x -= 1.5 / d1;
        return n1 * x * x + 0.75;
    } else if (x < 2.5 / d1) {
        x -= 2.25 / d1;
        return n1 * x * x + 0.9375;
    } else {
        x -= 2.625 / d1;
        return n1 * x * x + 0.984375;
    }
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = easeOutBounce(${inputs[0]});`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "bounce", "out", "animation", "interpolation", "ball"]
);

EaseOutBounceNode.manual = {
  description:
    "Applies a bounce ease-out curve that simulates a ball bouncing and settling.",
  html: `
    <h4>Behavior</h4>
    <p>Simulates a ball dropping and bouncing with decreasing height until it settles.</p>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Ball drop animations</li>
      <li>Bouncy landing effects</li>
      <li>Playful UI feedback</li>
    </ul>
  `,
};

