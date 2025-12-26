import { NodeType } from "./NodeType.js";

export const ScaleUVNode = new NodeType(
  "Scale UV",
  [
    { name: "UV", type: "vec2" },
    { name: "Scale", type: "vec2", defaultValue: [1.0, 1.0] },
    { name: "Center", type: "vec2" },
  ],
  [{ name: "Result", type: "vec2" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - ${inputs[2]}) * ${inputs[1]} + ${inputs[2]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = (${inputs[0]} - ${inputs[2]}) * ${inputs[1]} + ${inputs[2]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = (${inputs[0]} - ${inputs[2]}) * ${inputs[1]} + ${inputs[2]};`,
    },
  },
  "UV",
  ["scale", "zoom", "uv", "coordinates", "transform"]
);
