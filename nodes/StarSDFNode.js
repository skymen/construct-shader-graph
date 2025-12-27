import { NodeType } from "./NodeType.js";

export const StarSDFNode = new NodeType(
  "Star SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Outer Radius", type: "float" },
    { name: "Inner Radius", type: "float" },
    { name: "Points", type: "int" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdStar(vec2 p, vec2 center, float ro, float ri, int n) {
    vec2 q = p - center;
    float pi = 3.14159265359;
    float an = pi / float(n);
    float en = pi / float(n);
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));
    float bn = mod(atan(q.y, q.x), 2.0 * an) - an;
    q = length(q) * vec2(cos(bn), abs(sin(bn)));
    q = q - ro * acs;
    q = q + ecs * clamp(-dot(q, ecs), 0.0, ro * acs.y / ecs.y);
    float d = length(q) * sign(q.x);
    float k = ri * acs.y;
    return max(d, length(p - center) - ro) * sign(k - length(p - center) * sin(abs(bn)));
}
float sdStarSimple(vec2 p, vec2 center, float ro, float ri, int n) {
    vec2 q = p - center;
    float pi = 3.14159265359;
    float an = pi / float(n);
    float a = atan(q.y, q.x);
    float bn = mod(a, 2.0 * an) - an;
    float r = length(q);
    float c = cos(bn);
    float s = abs(sin(bn));
    float k = ri / ro;
    float edge = ro * (c + s * k * (1.0 - c) / (s + c * k));
    return r - edge;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdStarSimple(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgl2: {
      dependency: `float sdStarSimple(vec2 p, vec2 center, float ro, float ri, int n) {
    vec2 q = p - center;
    float pi = 3.14159265359;
    float an = pi / float(n);
    float a = atan(q.y, q.x);
    float bn = mod(a, 2.0 * an) - an;
    float r = length(q);
    float c = cos(bn);
    float s = abs(sin(bn));
    float k = ri / ro;
    float edge = ro * (c + s * k * (1.0 - c) / (s + c * k));
    return r - edge;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdStarSimple(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgpu: {
      dependency: `fn sdStarSimple(p: vec2<f32>, center: vec2<f32>, ro: f32, ri: f32, n: i32) -> f32 {
    let q = p - center;
    let pi = 3.14159265359;
    let an = pi / f32(n);
    let a = atan2(q.y, q.x);
    let bn = (a % (2.0 * an)) - an;
    let r = length(q);
    let c = cos(bn);
    let s = abs(sin(bn));
    let k = ri / ro;
    let edge = ro * (c + s * k * (1.0 - c) / (s + c * k));
    return r - edge;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdStarSimple(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
  },
  "SDF",
  ["sdf", "star", "shape", "distance", "field", "points"]
);
