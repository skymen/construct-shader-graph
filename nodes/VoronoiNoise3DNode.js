import { NodeType } from "./NodeType.js";

export const VoronoiNoise3DNode = new NodeType(
  "Voronoi Noise 3D",
  [
    { name: "UVW", type: "vec3" },
    { name: "Scale", type: "float" },
    { name: "Offset", type: "vec3" },
  ],
  [{ name: "Result", type: "float" }],
  "#4a3a5a",
  {
    webgl1: {
      dependency: `vec3 hash3_vor(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

float voronoiNoise3D(vec3 x) {
    vec3 n = floor(x);
    vec3 f = fract(x);
    
    float minDist = 1.0;
    
    for (int k = -1; k <= 1; k++) {
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec3 g = vec3(float(i), float(j), float(k));
                vec3 o = hash3_vor(n + g);
                vec3 r = g - f + o;
                float d = dot(r, r);
                minDist = min(minDist, d);
            }
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = voronoiNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgl2: {
      dependency: `vec3 hash3_vor(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

float voronoiNoise3D(vec3 x) {
    vec3 n = floor(x);
    vec3 f = fract(x);
    
    float minDist = 1.0;
    
    for (int k = -1; k <= 1; k++) {
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec3 g = vec3(float(i), float(j), float(k));
                vec3 o = hash3_vor(n + g);
                vec3 r = g - f + o;
                float d = dot(r, r);
                minDist = min(minDist, d);
            }
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = voronoiNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
    webgpu: {
      dependency: `fn hash3_vor(p: vec3<f32>) -> vec3<f32> {
    var p_var = vec3<f32>(dot(p, vec3<f32>(127.1, 311.7, 74.7)),
                          dot(p, vec3<f32>(269.5, 183.3, 246.1)),
                          dot(p, vec3<f32>(113.5, 271.9, 124.6)));
    return fract(sin(p_var) * 43758.5453123);
}

fn voronoiNoise3D(x: vec3<f32>) -> f32 {
    let n = floor(x);
    let f = fract(x);
    
    var minDist = 1.0;
    
    for (var k = -1; k <= 1; k++) {
        for (var j = -1; j <= 1; j++) {
            for (var i = -1; i <= 1; i++) {
                let g = vec3<f32>(f32(i), f32(j), f32(k));
                let o = hash3_vor(n + g);
                let r = g - f + o;
                let d = dot(r, r);
                minDist = min(minDist, d);
            }
        }
    }
    
    return sqrt(minDist);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = voronoiNoise3D((${inputs[0]} + ${inputs[2]}) * ${inputs[1]});`,
    },
  },
  "Noise",
  ["noise", "cellular", "worley", "cells", "procedural", "3d", "volume"]
);
