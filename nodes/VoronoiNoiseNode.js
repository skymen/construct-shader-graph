import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const VoronoiNoiseNode = new NodeType(
  "Voronoi Noise",
  [
    { name: "UV", type: "vec2" },
    { name: "Scale", type: "float", defaultValue: 1.0 },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.noise,
  {
    webgl1: {
      dependency: `vec2 hash2_vor(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoiNoise(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    
    float minDist = 1.0;
    
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2_vor(n + g);
            vec2 r = g - f + o;
            float d = dot(r, r);
            minDist = min(minDist, d);
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = voronoiNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgl2: {
      dependency: `vec2 hash2_vor(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoiNoise(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    
    float minDist = 1.0;
    
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2_vor(n + g);
            vec2 r = g - f + o;
            float d = dot(r, r);
            minDist = min(minDist, d);
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = voronoiNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash2_vor(p: vec2<f32>) -> vec2<f32> {
    var p_var = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return fract(sin(p_var) * 43758.5453);
}

fn voronoiNoise(x: vec2<f32>) -> f32 {
    let n = floor(x);
    let f = fract(x);
    
    var minDist = 1.0;
    
    for (var j = -1; j <= 1; j++) {
        for (var i = -1; i <= 1; i++) {
            let g = vec2<f32>(f32(i), f32(j));
            let o = hash2_vor(n + g);
            let r = g - f + o;
            let d = dot(r, r);
            minDist = min(minDist, d);
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = voronoiNoise((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
  },
  "Noise",
  ["noise", "cellular", "worley", "cells", "procedural"]
);
