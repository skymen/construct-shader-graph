import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PerlinNoiseNode = new NodeType(
  "Perlin Noise",
  [
    { name: "UV", type: "vec2" },
    { name: "Scale", type: "float", defaultValue: 1.0 },
    { name: "Offset", type: "vec2" },
  ],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.noise,
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

// Manual entry for documentation
PerlinNoiseNode.manual = {
  description:
    "Generates smooth, natural-looking procedural noise based on the classic Perlin noise algorithm. The output ranges from 0 to 1 with smooth transitions between values.",
  html: `
    <h4>What is Perlin Noise?</h4>
    <p>Perlin noise is a gradient noise algorithm that produces smooth, continuous random patterns. Unlike pure random noise, Perlin noise has natural-looking transitions that make it ideal for organic effects.</p>
    
    <h4>Parameters</h4>
    <ul>
      <li><strong>UV:</strong> The sampling coordinates (usually texture coordinates)</li>
      <li><strong>Scale:</strong> How "zoomed in" the noise is. Higher values = more detail</li>
      <li><strong>Offset:</strong> Shifts the noise pattern. Animate this for flowing effects</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Clouds, smoke, and fog effects</li>
      <li>Water caustics and ripples</li>
      <li>Terrain generation and heightmaps</li>
      <li>Organic distortion effects</li>
      <li>Animated effects (by animating offset)</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> Combine multiple octaves of Perlin noise with the FBM node for more complex, natural-looking patterns!
    </div>
  `,
};
