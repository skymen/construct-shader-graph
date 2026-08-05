import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// Rotate Around Point, but in a space that is squashed on one axis.
//
// Rotating normalised coordinates directly shears instead of rotating, by a
// factor equal to the shape's aspect ratio - on a 16x512 sprite a 15 degree
// turn throws coordinates 30 frame-widths sideways. Feeding Aspect Correct into
// the Aspect port scales into square space, rotates there, and scales back, so
// the result is a real rotation whatever the shape.
//
// The rotation direction matches Rotate Around Point.
const GLSL = `vec2 rotateAroundPointAspect(vec2 uv, vec2 center, float angle, vec2 aspect) {
    vec2 safeAspect = max(abs(aspect), vec2(0.00001));
    vec2 dir = (uv - center) * safeAspect;
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return center + (rot * dir) / safeAspect;
}`;

export const RotateAroundPointAspectNode = new NodeType(
  "Rotate Around Point (Aspect)",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
    { name: "Angle", type: "float" },
    { name: "Aspect", type: "vec2", defaultValue: [1, 1] },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPointAspect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: GLSL,
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = rotateAroundPointAspect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `fn rotateAroundPointAspect(uv: vec2<f32>, center: vec2<f32>, angle: f32, aspect: vec2<f32>) -> vec2<f32> {
    let safeAspect = max(abs(aspect), vec2<f32>(0.00001));
    let dir = (uv - center) * safeAspect;
    let s = sin(angle);
    let c = cos(angle);
    let rot = mat2x2<f32>(c, -s, s, c);
    return center + (rot * dir) / safeAspect;
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = rotateAroundPointAspect(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Vector",
  ["rotate", "rotation", "pivot", "transform", "uv", "aspect", "ratio"]
);
