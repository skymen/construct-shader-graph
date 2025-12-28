import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const PieSDFNode = new NodeType(
  "Pie SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Radius", type: "float" },
    { name: "Start Angle", type: "float" },
    { name: "End Angle", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  NODE_COLORS.sdfShape,
  {
    webgl1: {
      dependency: `float sdPie(vec2 p, vec2 center, float r, float startAngle, float endAngle) {
    vec2 q = p - center;
    float aperture = (endAngle - startAngle) * 0.5;
    float midAngle = (startAngle + endAngle) * 0.5;
    float ca = cos(midAngle), sa = sin(midAngle);
    q = mat2(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    float l = length(q) - r;
    vec2 sc = vec2(sin(aperture), cos(aperture));
    float m = length(q - sc * clamp(dot(q, sc), 0.0, r));
    return max(l, m * sign(sc.y * q.x - sc.x * q.y));
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdPie(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgl2: {
      dependency: `float sdPie(vec2 p, vec2 center, float r, float startAngle, float endAngle) {
    vec2 q = p - center;
    float aperture = (endAngle - startAngle) * 0.5;
    float midAngle = (startAngle + endAngle) * 0.5;
    float ca = cos(midAngle), sa = sin(midAngle);
    q = mat2(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    float l = length(q) - r;
    vec2 sc = vec2(sin(aperture), cos(aperture));
    float m = length(q - sc * clamp(dot(q, sc), 0.0, r));
    return max(l, m * sign(sc.y * q.x - sc.x * q.y));
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdPie(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
    webgpu: {
      dependency: `fn sdPie(p: vec2<f32>, center: vec2<f32>, r: f32, startAngle: f32, endAngle: f32) -> f32 {
    var q = p - center;
    let aperture = (endAngle - startAngle) * 0.5;
    let midAngle = (startAngle + endAngle) * 0.5;
    let ca = cos(midAngle); let sa = sin(midAngle);
    q = mat2x2<f32>(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    let l = length(q) - r;
    let sc = vec2<f32>(sin(aperture), cos(aperture));
    let m = length(q - sc * clamp(dot(q, sc), 0.0, r));
    return max(l, m * sign(sc.y * q.x - sc.x * q.y));
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdPie(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]});`,
    },
  },
  "SDF",
  ["sdf", "pie", "wedge", "slice", "shape", "distance", "field"]
);
