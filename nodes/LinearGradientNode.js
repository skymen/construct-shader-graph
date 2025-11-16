import { NodeType } from "./NodeType.js";

export const LinearGradientNode = new NodeType(
  "Linear Gradient",
  [
    { name: "UV", type: "vec2" },
    { name: "Start", type: "vec2" },
    { name: "End", type: "vec2" },
    { name: "Color A", type: "vec4" },
    { name: "Color B", type: "vec4" },
  ],
  [{ name: "Color", type: "vec4" }],
  "#e2844a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 gradientDir_${outputs[0]} = ${inputs[2]} - ${inputs[1]};
    float gradientLength_${outputs[0]} = length(gradientDir_${outputs[0]});
    vec2 gradientNorm_${outputs[0]} = gradientDir_${outputs[0]} / max(gradientLength_${outputs[0]}, 0.0001);
    float t_${outputs[0]} = dot(${inputs[0]} - ${inputs[1]}, gradientNorm_${outputs[0]}) / max(gradientLength_${outputs[0]}, 0.0001);
    t_${outputs[0]} = clamp(t_${outputs[0]}, 0.0, 1.0);
    vec4 ${outputs[0]} = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 gradientDir_${outputs[0]} = ${inputs[2]} - ${inputs[1]};
    float gradientLength_${outputs[0]} = length(gradientDir_${outputs[0]});
    vec2 gradientNorm_${outputs[0]} = gradientDir_${outputs[0]} / max(gradientLength_${outputs[0]}, 0.0001);
    float t_${outputs[0]} = dot(${inputs[0]} - ${inputs[1]}, gradientNorm_${outputs[0]}) / max(gradientLength_${outputs[0]}, 0.0001);
    t_${outputs[0]} = clamp(t_${outputs[0]}, 0.0, 1.0);
    vec4 ${outputs[0]} = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var gradientDir_${outputs[0]}: vec2<f32> = ${inputs[2]} - ${inputs[1]};
    var gradientLength_${outputs[0]}: f32 = length(gradientDir_${outputs[0]});
    var gradientNorm_${outputs[0]}: vec2<f32> = gradientDir_${outputs[0]} / max(gradientLength_${outputs[0]}, 0.0001);
    var t_${outputs[0]}: f32 = dot(${inputs[0]} - ${inputs[1]}, gradientNorm_${outputs[0]}) / max(gradientLength_${outputs[0]}, 0.0001);
    t_${outputs[0]} = clamp(t_${outputs[0]}, 0.0, 1.0);
    var ${outputs[0]}: vec4<f32> = mix(${inputs[3]}, ${inputs[4]}, t_${outputs[0]});`,
    },
  },
  "Color",
  ["gradient", "linear", "blend", "interpolate", "lerp", "color"]
);
