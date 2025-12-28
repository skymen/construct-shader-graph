import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SetVec3AlphaNode = new NodeType(
  "Set Vec3 Alpha",
  [
    { name: "Color", type: "vec3" },
    { name: "Old Alpha", type: "float" },
    { name: "New Alpha", type: "float" },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.colorAdjust,
  {
    webgl1: {
      dependency: `vec3 setVec3Alpha(vec3 color, float oldAlpha, float newAlpha) {
    vec3 rgb = color;
    
    // Unpremultiply by old alpha
    if (oldAlpha > 0.0001) {
        rgb = rgb / oldAlpha;
    }
    
    // Multiply by new alpha
    return rgb * newAlpha;
}`,
      execution: (inputs, outputs) => {
        return `    vec3 ${outputs[0]} = setVec3Alpha(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
    webgl2: {
      dependency: `vec3 setVec3Alpha(vec3 color, float oldAlpha, float newAlpha) {
    vec3 rgb = color;
    
    // Unpremultiply by old alpha
    if (oldAlpha > 0.0001) {
        rgb = rgb / oldAlpha;
    }
    
    // Multiply by new alpha
    return rgb * newAlpha;
}`,
      execution: (inputs, outputs) => {
        return `    vec3 ${outputs[0]} = setVec3Alpha(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
    webgpu: {
      dependency: `fn setVec3Alpha(color: vec3<f32>, oldAlpha: f32, newAlpha: f32) -> vec3<f32> {
    var rgb = color;
    
    // Unpremultiply by old alpha
    if (oldAlpha > 0.0001) {
        rgb = rgb / oldAlpha;
    }
    
    // Multiply by new alpha
    return rgb * newAlpha;
}`,
      execution: (inputs, outputs) => {
        return `    var ${outputs[0]}: vec3<f32> = setVec3Alpha(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`;
      },
    },
  },
  "Color",
  [
    "alpha",
    "transparency",
    "premultiply",
    "unpremultiply",
    "vec3",
    "rgb",
    "opacity",
    "set alpha",
  ]
);
