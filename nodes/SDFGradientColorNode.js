import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

const inputs = [
  { name: "SDF", type: "float" },
  { name: "Outline In", type: "float", defaultValue: 0.02 },
  { name: "Outline Out", type: "float", defaultValue: 0.02 },
  { name: "Outline Color", type: "vec4", defaultValue: [0.0, 0.0, 0.0, 1.0] },
  { name: "Inner Edge Color", type: "vec4", defaultValue: [1.0, 1.0, 1.0, 1.0] },
  { name: "Inner Far Color", type: "vec4", defaultValue: [0.2, 0.4, 1.0, 1.0] },
  { name: "Outer Edge Color", type: "vec4", defaultValue: [1.0, 1.0, 1.0, 0.0] },
  { name: "Outer Far Color", type: "vec4", defaultValue: [1.0, 1.0, 1.0, 0.0] },
  { name: "Feather", type: "float", defaultValue: 0.001 },
  { name: "Inner Distance", type: "float", defaultValue: 0.25 },
  { name: "Outer Distance", type: "float", defaultValue: 0.25 },
];

const glslExecution = (inputs, outputs) => {
  const out = outputs[0];
  return `    float d_${out} = ${inputs[0]};
    float outlineIn_${out} = max(${inputs[1]}, 0.0);
    float outlineOut_${out} = max(${inputs[2]}, 0.0);
    float feather_${out} = max(${inputs[8]}, 0.0001);
    float innerDist_${out} = max(${inputs[9]}, 0.0001);
    float outerDist_${out} = max(${inputs[10]}, 0.0001);
    float innerT_${out} = clamp((-d_${out} - outlineIn_${out}) / innerDist_${out}, 0.0, 1.0);
    float outerT_${out} = clamp((d_${out} - outlineOut_${out}) / outerDist_${out}, 0.0, 1.0);
    vec4 innerColor_${out} = mix(${inputs[4]}, ${inputs[5]}, innerT_${out});
    vec4 outerColor_${out} = mix(${inputs[6]}, ${inputs[7]}, outerT_${out});
    vec4 baseColor_${out} = mix(innerColor_${out}, outerColor_${out}, smoothstep(-feather_${out}, feather_${out}, d_${out}));
    float outlineMask_${out} = smoothstep(-outlineIn_${out} - feather_${out}, -outlineIn_${out} + feather_${out}, d_${out}) * (1.0 - smoothstep(outlineOut_${out} - feather_${out}, outlineOut_${out} + feather_${out}, d_${out}));
    vec4 ${out} = mix(baseColor_${out}, ${inputs[3]}, outlineMask_${out});`;
};

const wgslExecution = (inputs, outputs) => {
  const out = outputs[0];
  return `    var d_${out}: f32 = ${inputs[0]};
    var outlineIn_${out}: f32 = max(${inputs[1]}, 0.0);
    var outlineOut_${out}: f32 = max(${inputs[2]}, 0.0);
    var feather_${out}: f32 = max(${inputs[8]}, 0.0001);
    var innerDist_${out}: f32 = max(${inputs[9]}, 0.0001);
    var outerDist_${out}: f32 = max(${inputs[10]}, 0.0001);
    var innerT_${out}: f32 = clamp((-d_${out} - outlineIn_${out}) / innerDist_${out}, 0.0, 1.0);
    var outerT_${out}: f32 = clamp((d_${out} - outlineOut_${out}) / outerDist_${out}, 0.0, 1.0);
    var innerColor_${out}: vec4<f32> = mix(${inputs[4]}, ${inputs[5]}, innerT_${out});
    var outerColor_${out}: vec4<f32> = mix(${inputs[6]}, ${inputs[7]}, outerT_${out});
    var baseColor_${out}: vec4<f32> = mix(innerColor_${out}, outerColor_${out}, smoothstep(-feather_${out}, feather_${out}, d_${out}));
    var outlineMask_${out}: f32 = smoothstep(-outlineIn_${out} - feather_${out}, -outlineIn_${out} + feather_${out}, d_${out}) * (1.0 - smoothstep(outlineOut_${out} - feather_${out}, outlineOut_${out} + feather_${out}, d_${out}));
    var ${out}: vec4<f32> = mix(baseColor_${out}, ${inputs[3]}, outlineMask_${out});`;
};

export const SDFGradientColorNode = new NodeType(
  "SDF Gradient Color",
  inputs,
  [{ name: "Color", type: "vec4" }],
  NODE_COLORS.sdfOutput,
  {
    webgl1: { dependency: "", execution: glslExecution },
    webgl2: { dependency: "", execution: glslExecution },
    webgpu: { dependency: "", execution: wgslExecution },
  },
  "SDF",
  ["sdf", "color", "gradient", "outline", "inside", "outside", "feather", "output"]
);
