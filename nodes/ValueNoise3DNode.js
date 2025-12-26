import { NodeType } from "./NodeType.js";

export const ValueNoise3DNode = new NodeType(
  "Value Noise 3D",
  [
    { name: "UVW", type: "vec3" },
    { name: "Scale", type: "float", defaultValue: 1.0 },
    { name: "Offset", type: "vec3" },
  ],
  [{ name: "Result", type: "float" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `float hash3D(vec3 p) {
    p = fract(p * vec3(123.34, 456.21, 789.56));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float valueNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(hash3D(i + vec3(0.0, 0.0, 0.0)),
                       hash3D(i + vec3(1.0, 0.0, 0.0)), u.x),
                   mix(hash3D(i + vec3(0.0, 1.0, 0.0)),
                       hash3D(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(hash3D(i + vec3(0.0, 0.0, 1.0)),
                       hash3D(i + vec3(1.0, 0.0, 1.0)), u.x),
                   mix(hash3D(i + vec3(0.0, 1.0, 1.0)),
                       hash3D(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = valueNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgl2: {
      dependency: `float hash3D(vec3 p) {
    p = fract(p * vec3(123.34, 456.21, 789.56));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float valueNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(hash3D(i + vec3(0.0, 0.0, 0.0)),
                       hash3D(i + vec3(1.0, 0.0, 0.0)), u.x),
                   mix(hash3D(i + vec3(0.0, 1.0, 0.0)),
                       hash3D(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(hash3D(i + vec3(0.0, 0.0, 1.0)),
                       hash3D(i + vec3(1.0, 0.0, 1.0)), u.x),
                   mix(hash3D(i + vec3(0.0, 1.0, 1.0)),
                       hash3D(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = valueNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash3D_vn(p: vec3<f32>) -> f32 {
    var p_var = fract(p * vec3<f32>(123.34, 456.21, 789.56));
    p_var += dot(p_var, p_var.yzx + 19.19);
    return fract((p_var.x + p_var.y) * p_var.z);
}

fn valueNoise3D(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    let u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(hash3D_vn(i + vec3<f32>(0.0, 0.0, 0.0)),
                       hash3D_vn(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
                   mix(hash3D_vn(i + vec3<f32>(0.0, 1.0, 0.0)),
                       hash3D_vn(i + vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(hash3D_vn(i + vec3<f32>(0.0, 0.0, 1.0)),
                       hash3D_vn(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
                   mix(hash3D_vn(i + vec3<f32>(0.0, 1.0, 1.0)),
                       hash3D_vn(i + vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = valueNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
  },
  "Noise",
  ["noise", "procedural", "random", "3d", "volume"]
);
