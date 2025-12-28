import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

const N1 = "7.5625";
const D1 = "2.75";

export const EaseInOutBounceNode = new NodeType(
  "Ease In Out Bounce",
  [{ name: "T", type: "genType" }],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.easing,
  {
    webgl1: {
      dependency: `
float easeOutBounceForInOut(float x) {
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

float easeInOutBounce(float x) {
    return x < 0.5
        ? (1.0 - easeOutBounceForInOut(1.0 - 2.0 * x)) / 2.0
        : (1.0 + easeOutBounceForInOut(2.0 * x - 1.0)) / 2.0;
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeInOutBounce(${inputs[0]});`,
    },
    webgl2: {
      dependency: `
float easeOutBounceForInOut(float x) {
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

float easeInOutBounce(float x) {
    return x < 0.5
        ? (1.0 - easeOutBounceForInOut(1.0 - 2.0 * x)) / 2.0
        : (1.0 + easeOutBounceForInOut(2.0 * x - 1.0)) / 2.0;
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = easeInOutBounce(${inputs[0]});`,
    },
    webgpu: {
      dependency: `
fn easeOutBounceForInOut(x_in: f32) -> f32 {
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

fn easeInOutBounce(x: f32) -> f32 {
    if (x < 0.5) {
        return (1.0 - easeOutBounceForInOut(1.0 - 2.0 * x)) / 2.0;
    } else {
        return (1.0 + easeOutBounceForInOut(2.0 * x - 1.0)) / 2.0;
    }
}
`,
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = easeInOutBounce(${inputs[0]});`;
      },
    },
  },
  "Easing",
  ["ease", "easing", "bounce", "inout", "animation", "interpolation", "ball"]
);

EaseInOutBounceNode.manual = {
  description:
    "Applies a bounce ease-in-out curve that simulates bouncing at both ends of the animation.",
  html: `
    <h4>Behavior</h4>
    <p>Combines bounce-in and bounce-out for a full bouncing transition.</p>
    
    <h4>Input Range</h4>
    <ul>
      <li><code>T = 0</code> → Returns 0</li>
      <li><code>T = 0.5</code> → Returns 0.5</li>
      <li><code>T = 1</code> → Returns 1</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Full bounce animations</li>
      <li>Playful complete transitions</li>
      <li>Game-like UI effects</li>
    </ul>
  `,
};
