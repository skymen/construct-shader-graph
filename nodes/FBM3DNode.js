import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FBM3DNode = new NodeType(
  "FBM 3D",
  [
    { name: "UVW", type: "vec3" },
    { name: "Octaves", type: "int", defaultValue: 3 },
    { name: "Scale", type: "float", defaultValue: 1.0 },
    { name: "Offset", type: "vec3", defaultValue: [0.0, 0.0, 0.0] },
  ],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.noise,
  {
    webgl1: {
      dependency: `vec3 hash3_fbm(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise3D_fbm(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3_fbm(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
                       dot(hash3_fbm(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                       dot(hash3_fbm(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(dot(hash3_fbm(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                       dot(hash3_fbm(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                       dot(hash3_fbm(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

float fbm3D(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * perlinNoise3D_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = fbm3D((${inputs[0]} + ${inputs[3]}) * ${inputs[2]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: `vec3 hash3_fbm(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float perlinNoise3D_fbm(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3_fbm(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
                       dot(hash3_fbm(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                       dot(hash3_fbm(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(dot(hash3_fbm(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                       dot(hash3_fbm(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                       dot(hash3_fbm(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

float fbm3D(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * perlinNoise3D_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = fbm3D((${inputs[0]} + ${inputs[3]}) * ${inputs[2]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash3_fbm(p: vec3<f32>) -> vec3<f32> {
    var p_var = vec3<f32>(dot(p, vec3<f32>(127.1, 311.7, 74.7)),
                          dot(p, vec3<f32>(269.5, 183.3, 246.1)),
                          dot(p, vec3<f32>(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p_var) * 43758.5453123);
}

fn perlinNoise3D_fbm(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3_fbm(i + vec3<f32>(0.0, 0.0, 0.0)), f - vec3<f32>(0.0, 0.0, 0.0)),
                       dot(hash3_fbm(i + vec3<f32>(1.0, 0.0, 0.0)), f - vec3<f32>(1.0, 0.0, 0.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3<f32>(0.0, 1.0, 0.0)), f - vec3<f32>(0.0, 1.0, 0.0)),
                       dot(hash3_fbm(i + vec3<f32>(1.0, 1.0, 0.0)), f - vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(dot(hash3_fbm(i + vec3<f32>(0.0, 0.0, 1.0)), f - vec3<f32>(0.0, 0.0, 1.0)),
                       dot(hash3_fbm(i + vec3<f32>(1.0, 0.0, 1.0)), f - vec3<f32>(1.0, 0.0, 1.0)), u.x),
                   mix(dot(hash3_fbm(i + vec3<f32>(0.0, 1.0, 1.0)), f - vec3<f32>(0.0, 1.0, 1.0)),
                       dot(hash3_fbm(i + vec3<f32>(1.0, 1.0, 1.0)), f - vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

fn fbm3D(p: vec3<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    
    for (var i = 0; i < 8; i++) {
        if (i >= octaves) { break; }
        value += amplitude * perlinNoise3D_fbm(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value * 0.5 + 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = fbm3D((${inputs[0]} + ${inputs[3]}) * ${inputs[2]}, ${inputs[1]});`,
    },
  },
  "Noise",
  [
    "fractal",
    "brownian",
    "motion",
    "turbulence",
    "noise",
    "octaves",
    "layered",
    "3d",
    "volume",
  ]
);
