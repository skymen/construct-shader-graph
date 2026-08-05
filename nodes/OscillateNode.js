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
    float p = max(abs(period), 0.0001);
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
    let p = max(abs(period), 0.0001);
    return sin(((c3Params.seconds % p) / p + phase) * 6.28318530718);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = oscillate(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Math",
  ["sine", "wave", "wobble", "sway", "pulse", "time", "animate", "period"]
);
