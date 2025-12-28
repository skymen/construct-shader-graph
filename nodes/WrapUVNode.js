import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const WrapUVNode = new NodeType(
  "Wrap UV",
  [
    { name: "UV", type: "vec2" },
    { name: "Start", type: "vec2" },
    { name: "Size", type: "vec2" },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.uvTransform,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[1]} + mod(${inputs[0]} - ${inputs[1]} + ${inputs[3]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[1]} + mod(${inputs[0]} - ${inputs[1]} + ${inputs[3]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = ${inputs[1]} + (${inputs[0]} - ${inputs[1]} + ${inputs[3]}) - ${inputs[2]} * floor((${inputs[0]} - ${inputs[1]} + ${inputs[3]}) / ${inputs[2]});`,
    },
  },
  "UV",
  ["wrap", "repeat", "tile", "uv", "coordinates", "offset"]
);
