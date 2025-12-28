import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFColorNode = new NodeType(
  "SDF Color",
  [
    { name: "SDF", type: "float" },
    { name: "Inside", type: "vec4" },
    { name: "Outside", type: "vec4" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Color", type: "vec4" }],
  NODE_COLORS.sdfOutput,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float feather_${outputs[0]} = max(${inputs[3]}, 0.0001);
    float t_${outputs[0]} = smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});
    vec4 ${outputs[0]} = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float feather_${outputs[0]} = max(${inputs[3]}, 0.0001);
    float t_${outputs[0]} = smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});
    vec4 ${outputs[0]} = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var feather_${outputs[0]}: f32 = max(${inputs[3]}, 0.0001);
    var t_${outputs[0]}: f32 = smoothstep(-feather_${outputs[0]}, feather_${outputs[0]}, ${inputs[0]});
    var ${outputs[0]}: vec4<f32> = mix(${inputs[1]}, ${inputs[2]}, t_${outputs[0]});`,
    },
  },
  "SDF",
  ["sdf", "color", "fill", "inside", "outside", "output"]
);
