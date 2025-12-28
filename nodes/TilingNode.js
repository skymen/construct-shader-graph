import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const TilingNode = new NodeType(
  "Tiling",
  [
    { name: "UV", type: "vec2" },
    { name: "Start", type: "vec2" },
    { name: "Size", type: "vec2" },
    { name: "Scale", type: "vec2", defaultValue: [1.0, 1.0] },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.uvTransform,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[1]} + mod((${inputs[0]} - ${inputs[1]}) * ${inputs[3]} + ${inputs[4]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = ${inputs[1]} + mod((${inputs[0]} - ${inputs[1]}) * ${inputs[3]} + ${inputs[4]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) => {
        const scaled = `((${inputs[0]} - ${inputs[1]}) * ${inputs[3]} + ${inputs[4]})`;
        return `    var ${outputs[0]}: vec2<f32> = ${inputs[1]} + ${scaled} - ${inputs[2]} * floor(${scaled} / ${inputs[2]});`;
      },
    },
  },
  "UV",
  ["tiling", "tile", "repeat", "scale", "wrap", "uv", "coordinates"]
);
