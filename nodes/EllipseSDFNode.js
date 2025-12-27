import { NodeType } from "./NodeType.js";

export const EllipseSDFNode = new NodeType(
  "Ellipse SDF",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Size", type: "vec2" },
  ],
  [{ name: "Distance", type: "float" }],
  "#2d6e4f",
  {
    webgl1: {
      dependency: `float sdEllipse(vec2 p, vec2 center, vec2 ab) {
    vec2 pa = p - center;
    vec2 r = ab * 0.5;
    float k0 = length(pa / r);
    float k1 = length(pa / (r * r));
    return k0 * (k0 - 1.0) / k1;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdEllipse(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: `float sdEllipse(vec2 p, vec2 center, vec2 ab) {
    vec2 pa = p - center;
    vec2 r = ab * 0.5;
    float k0 = length(pa / r);
    float k1 = length(pa / (r * r));
    return k0 * (k0 - 1.0) / k1;
}`,
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = sdEllipse(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: `fn sdEllipse(p: vec2<f32>, center: vec2<f32>, ab: vec2<f32>) -> f32 {
    let pa = p - center;
    let r = ab * 0.5;
    let k0 = length(pa / r);
    let k1 = length(pa / (r * r));
    return k0 * (k0 - 1.0) / k1;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = sdEllipse(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "SDF",
  ["sdf", "ellipse", "oval", "shape", "distance", "field"]
);
