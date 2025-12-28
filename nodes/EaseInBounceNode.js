import { NodeType } from "./NodeType.js";
import { toWGSLType } from "./PortTypes.js";

const N1 = "7.5625";
const D1 = "2.75";

export const EaseInBounceNode = new NodeType(
  "Ease In Bounce",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  "#ff4000",
  {
    webgl1: {
      dependency: `
float easeOutBounceForIn(float x) {
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

float easeInBounce(float x) {
    return 1.0 - easeOutBounceForIn(1.0 - x);
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeInBounce(${inputs[0]});`,
    },
    webgl2: {
      dependency: `
float easeOutBounceForIn(float x) {
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

float easeInBounce(float x) {
    return 1.0 - easeOutBounceForIn(1.0 - x);
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeInBounce(${inputs[0]});`,
    },
    webgpu: {
      dependency: `
fn easeOutBounceForIn(x_in: f32) -> f32 {
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

fn easeInBounce(x: f32) -> f32 {
    return 1.0 - easeOutBounceForIn(1.0 - x);
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = easeInBounce(${inputs[0]});`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "bounce", "in", "animation", "interpolation", "ball"]
);

EaseInBounceNode.manual = {
  description:
    "Applies a bounce ease-in curve that simulates reverse bouncing before accelerating.",
  html: `
    <h4>Behavior</h4>
    <p>Inverse of ease-out bounce. Creates a winding-up bounce effect.</p>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Anticipation bounce effects</li>
      <li>Reverse ball physics</li>
      <li>Wind-up animations</li>
    </ul>
  `,
};
