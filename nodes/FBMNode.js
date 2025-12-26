import { NodeType } from "./NodeType.js";

export const FBMNode = new NodeType(
  "FBM",
  [
    { name: "UV", type: "vec2" },
    { name: "Octaves", type: "int", defaultValue: 3 },
  ],
  [{ name: "Result", type: "float" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec2 hash2_fbm(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise_fbm(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2_fbm(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2_fbm(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2_fbm(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2_fbm(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * perlinNoise_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = fbm(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: `vec2 hash2_fbm(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise_fbm(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2_fbm(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2_fbm(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2_fbm(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2_fbm(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * perlinNoise_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = fbm(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash2_fbm(p: vec2<f32>) -> vec2<f32> {
    var p_var = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p_var) * 43758.5453123);
}

fn perlinNoise_fbm(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2_fbm(i + vec2<f32>(0.0, 0.0)), f - vec2<f32>(0.0, 0.0)),
                   dot(hash2_fbm(i + vec2<f32>(1.0, 0.0)), f - vec2<f32>(1.0, 0.0)), u.x),
               mix(dot(hash2_fbm(i + vec2<f32>(0.0, 1.0)), f - vec2<f32>(0.0, 1.0)),
                   dot(hash2_fbm(i + vec2<f32>(1.0, 1.0)), f - vec2<f32>(1.0, 1.0)), u.x), u.y);
}

fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    
    for (var i = 0; i < 8; i++) {
        if (i >= octaves) { break; }
        value += amplitude * perlinNoise_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = fbm(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Noise",
  ["fractal", "brownian", "motion", "turbulence", "noise", "octaves", "layered"]
);
