import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// A -1..1 sine wave that repeats every Period seconds.
//
// seconds is wrapped into one period before the multiply so the angle stays
// small no matter how long the layout has been running - feeding a raw running
// time straight into sin() loses precision and the wave starts to stutter.
// Phase is in turns, so 0.25 is a quarter period later; give instances
// different phases to stop a field of them moving in lockstep.
//
// Remember to tick "animated" in shader settings, or C3 won't redraw.
const GLSL = `float oscillate(float period, float phase) {
    float p = max(abs(period), 0.00001);
    return sin((mod(seconds, p) / p + phase) * 6.28318530718);
}`;

export const OscillateNode = new NodeType(
  "Oscillate",
  [
    { name: "Period", type: "float", defaultValue: 1.0 },
    { name: "Phase", type: "float", defaultValue: 0.0 },
  ],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = oscillate(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = oscillate(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn oscillate(period: f32, phase: f32) -> f32 {
    let p = max(abs(period), 0.00001);
    return sin(((c3Params.seconds % p) / p + phase) * 6.28318530718);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = oscillate(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Math",
  ["sine", "wave", "wobble", "sway", "pulse", "time", "animate", "period"]
);

OscillateNode.manual = {
  description:
    "A sine wave between -1 and 1 that completes one cycle every Period seconds. Driven by the shader's own clock, so it needs no time input.",
  html: `
    <h4>Formula</h4>
    <pre><code>Value = sin((mod(seconds, Period) / Period + Phase) * 2&pi;)</code></pre>

    <h4>Inputs</h4>
    <ul>
      <li><code>Period</code> — seconds per full cycle. Default <code>1.0</code></li>
      <li><code>Phase</code> — offset in <strong>turns</strong>, not radians. <code>0.25</code> is a quarter cycle later</li>
    </ul>

    <h4>Why wrap the time first</h4>
    <p>
      <code>seconds</code> grows without bound while a layout runs. Feeding it straight into
      <code>sin()</code> means the angle keeps growing too, and the wave starts to stutter as
      precision runs out. Wrapping into one period first keeps the angle inside 0..2&pi; forever.
    </p>

    <h4>Reshaping the output</h4>
    <ul>
      <li>0..1 instead of -1..1 → follow with <code>Remap</code> (-1, 1, 0, 1)</li>
      <li>Amplitude and offset → <code>Remap</code>, or a plain multiply and add</li>
      <li>Cosine → set <code>Phase</code> to <code>0.25</code></li>
    </ul>

    <div class="warning">
      Enable <strong>animated</strong> in shader settings. Without it C3 will not redraw the
      effect every frame and the wave appears frozen.
    </div>

    <div class="tip">
      Give instances different <code>Phase</code> values to stop a field of them moving in
      lockstep — a uniform wired into Phase works well for this.
    </div>
  `,
};
