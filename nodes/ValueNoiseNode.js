import { NodeType } from "./NodeType.js";

export const ValueNoiseNode = new NodeType(
  "Value Noise",
  [
    { name: "UV", type: "vec2" },
    { name: "Scale", type: "float" },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "float" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = valueNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgl2: {
      dependency: `float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = valueNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash_vn(p: vec2<f32>) -> f32 {
    var p_var = fract(p * vec2<f32>(123.34, 456.21));
    p_var += dot(p_var, p_var + 45.32);
    return fract(p_var.x * p_var.y);
}

fn valueNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    let a = hash_vn(i);
    let b = hash_vn(i + vec2<f32>(1.0, 0.0));
    let c = hash_vn(i + vec2<f32>(0.0, 1.0));
    let d = hash_vn(i + vec2<f32>(1.0, 1.0));
    
    let u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = valueNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
  },
  "Noise",
  ["noise", "procedural", "random", "texture"]
);
