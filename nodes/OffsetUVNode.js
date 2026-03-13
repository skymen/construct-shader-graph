import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const OffsetUVNode = new NodeType(
  "Offset UV",
  [
    { name: "UV", type: "vec2" },
    { name: "Offset", type: "vec2", defaultValue: [0.0, 0.0] },
    { name: "Clamp Start", type: "vec2", defaultValue: [0.0, 0.0] },
    { name: "Clamp End", type: "vec2", defaultValue: [1.0, 1.0] },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.uvTransform,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]} + ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = clamp(${inputs[0]} + ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = clamp(${inputs[0]} + ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "UV",
  ["offset", "shift", "move", "uv", "coordinates", "transform", "clamp", "bounds"]
);
