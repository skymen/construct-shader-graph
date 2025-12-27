import { NodeType } from "./NodeType.js";

export const PolygonSDFNode = new NodeType(
  "Polygon SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Radius", type: "float" },
    { name: "Sides", type: "int" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdPolygon(vec2 p, vec2 center, float r, int n) {
    vec2 q = p - center;
    float pi = 3.14159265359;
    float an = pi / float(n);
    float he = r * cos(an);
    float a = atan(q.y, q.x);
    float bn = mod(a, 2.0 * an) - an;
    vec2 cs = vec2(cos(bn), abs(sin(bn)));
    float d = length(q) * cs.x - he;
    return d;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdPolygon(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `float sdPolygon(vec2 p, vec2 center, float r, int n) {
    vec2 q = p - center;
    float pi = 3.14159265359;
    float an = pi / float(n);
    float he = r * cos(an);
    float a = atan(q.y, q.x);
    float bn = mod(a, 2.0 * an) - an;
    vec2 cs = vec2(cos(bn), abs(sin(bn)));
    float d = length(q) * cs.x - he;
    return d;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdPolygon(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn sdPolygon(p: vec2<f32>, center: vec2<f32>, r: f32, n: i32) -> f32 {
    let q = p - center;
    let pi = 3.14159265359;
    let an = pi / f32(n);
    let he = r * cos(an);
    let a = atan2(q.y, q.x);
    let bn = (a % (2.0 * an)) - an;
    let cs = vec2<f32>(cos(bn), abs(sin(bn)));
    let d = length(q) * cs.x - he;
    return d;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdPolygon(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "SDF",
  [
    "sdf",
    "polygon",
    "hexagon",
    "pentagon",
    "shape",
    "distance",
    "field",
    "regular",
  ]
);
