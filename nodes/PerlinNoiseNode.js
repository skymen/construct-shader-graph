import { NodeType } from "./NodeType.js";

export const PerlinNoiseNode = new NodeType(
  "Perlin Noise",
  [
    { name: "UV", type: "vec2" },
    { name: "Scale", type: "float" },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "float" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = perlinNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]}) * 0.5 + 0.5;`,
    },
    webgl2: {
      dependency: `vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = perlinNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]}) * 0.5 + 0.5;`,
    },
    webgpu: {
      dependency: `fn hash2_pn(p: vec2<f32>) -> vec2<f32> {
    var p_var = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p_var) * 43758.5453123);
}

fn perlinNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    let u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(dot(hash2_pn(i + vec2<f32>(0.0, 0.0)), f - vec2<f32>(0.0, 0.0)),
                   dot(hash2_pn(i + vec2<f32>(1.0, 0.0)), f - vec2<f32>(1.0, 0.0)), u.x),
               mix(dot(hash2_pn(i + vec2<f32>(0.0, 1.0)), f - vec2<f32>(0.0, 1.0)),
                   dot(hash2_pn(i + vec2<f32>(1.0, 1.0)), f - vec2<f32>(1.0, 1.0)), u.x), u.y);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = perlinNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]}) * 0.5 + 0.5;`,
    },
  },
  "Noise",
  ["noise", "procedural", "gradient", "smooth"]
);
