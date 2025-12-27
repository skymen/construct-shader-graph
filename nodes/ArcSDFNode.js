import { NodeType } from "./NodeType.js";

export const ArcSDFNode = new NodeType(
  "Arc SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Radius", type: "float" },
    { name: "Start Angle", type: "float" },
    { name: "End Angle", type: "float" },
    { name: "Thickness", type: "float" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdArc(vec2 p, vec2 center, float r, float startAngle, float endAngle, float th) {
    vec2 q = p - center;
    float aperture = (endAngle - startAngle) * 0.5;
    float midAngle = (startAngle + endAngle) * 0.5;
    float ca = cos(midAngle), sa = sin(midAngle);
    q = mat2(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    float k = (aperture > 0.0) ? 1.0 : -1.0;
    vec2 sca = vec2(sin(aperture), cos(aperture));
    if (sca.y * q.x > sca.x * q.y) {
        return length(q - sca * r) - th * 0.5;
    }
    return abs(length(q) - r) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdArc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]}, ${inputs[5]});`,
    },
    webgl2: {
      dependency: `float sdArc(vec2 p, vec2 center, float r, float startAngle, float endAngle, float th) {
    vec2 q = p - center;
    float aperture = (endAngle - startAngle) * 0.5;
    float midAngle = (startAngle + endAngle) * 0.5;
    float ca = cos(midAngle), sa = sin(midAngle);
    q = mat2(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    vec2 sca = vec2(sin(aperture), cos(aperture));
    if (sca.y * q.x > sca.x * q.y) {
        return length(q - sca * r) - th * 0.5;
    }
    return abs(length(q) - r) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdArc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]}, ${inputs[5]});`,
    },
    webgpu: {
      dependency: `fn sdArc(p: vec2<f32>, center: vec2<f32>, r: f32, startAngle: f32, endAngle: f32, th: f32) -> f32 {
    var q = p - center;
    let aperture = (endAngle - startAngle) * 0.5;
    let midAngle = (startAngle + endAngle) * 0.5;
    let ca = cos(midAngle); let sa = sin(midAngle);
    q = mat2x2<f32>(ca, sa, -sa, ca) * q;
    q.x = abs(q.x);
    let sca = vec2<f32>(sin(aperture), cos(aperture));
    if (sca.y * q.x > sca.x * q.y) {
        return length(q - sca * r) - th * 0.5;
    }
    return abs(length(q) - r) - th * 0.5;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdArc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]}, ${inputs[5]});`,
    },
  },
  "SDF",
  ["sdf", "arc", "curve", "shape", "distance", "field", "ring", "partial"]
);
