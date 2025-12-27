import { NodeType } from "./NodeType.js";

export const SDFColorNode = new NodeType(
  "SDF Color",
  [
    { name: "SDF", type: "float" },
    { name: "Inside", type: "vec4" },
    { name: "Outside", type: "vec4" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Color", type: "vec4" }],
  "#6e4a2d",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float t_${outputs[0]} = smoothstep(-${inputs[3]}, ${inputs[3]}, ${inputs[0]});
    vec4 ${outputs[0]} = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float t_${outputs[0]} = smoothstep(-${inputs[3]}, ${inputs[3]}, ${inputs[0]});
    vec4 ${outputs[0]} = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var t_${outputs[0]}: f32 = smoothstep(-${inputs[3]}, ${inputs[3]}, ${inputs[0]});
    var ${outputs[0]}: vec4<f32> = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
  },
  "SDF",
  ["sdf", "color", "fill", "inside", "outside", "output"]
);
