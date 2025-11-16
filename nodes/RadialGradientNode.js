import { NodeType } from "./NodeType.js";

export const RadialGradientNode = new NodeType(
  "Radial Gradient",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Radius", type: "float" },
    { name: "Color A", type: "vec4" },
    { name: "Color B", type: "vec4" },
  ],
  [{ name: "Color", type: "vec4" }],
  "#e2844a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float dist_${outputs[0]} = distance(${inputs[0]}, ${inputs[1]});
    float t_${outputs[0]} = clamp(dist_${outputs[0]} / max(${inputs[2]}, 0.0001), 0.0, 1.0);
    vec4 ${outputs[0]} = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float dist_${outputs[0]} = distance(${inputs[0]}, ${inputs[1]});
    float t_${outputs[0]} = clamp(dist_${outputs[0]} / max(${inputs[2]}, 0.0001), 0.0, 1.0);
    vec4 ${outputs[0]} = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var dist_${outputs[0]}: f32 = distance(${inputs[0]}, ${inputs[1]});
    var t_${outputs[0]}: f32 = clamp(dist_${outputs[0]} / max(${inputs[2]}, 0.0001), 0.0, 1.0);
    var ${outputs[0]}: vec4<f32> = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
  },
  "Color",
  ["gradient", "radial", "circular", "blend", "interpolate", "color"]
);
