import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SetVec4AlphaNode = new NodeType(
  "Set Vec4 Alpha",
  [
    { name: "Color", type: "vec4" },
    { name: "Alpha", type: "float" },
  ],
  [{ name: "Result", type: "vec4" }],
  NODE_COLORS.colorAdjust,
  {
    webgl1: {
      dependency: `vec4 setVec4Alpha(vec4 color, float alpha, bool isPremultiplied) {
    vec3 rgb = color.rgb;
    
    // If input is premultiplied, unpremultiply it first
    if (isPremultiplied && color.a > 0.0001) {
        rgb = rgb / color.a;
    }
    
    // Set new alpha and premultiply
    return vec4(rgb * alpha, alpha);
}`,
      execution: (inputs, outputs, node) => {
        const isPremultiplied =
          node.operation === "premultiplied" ? "true" : "false";
        return `    vec4 ${outputs[0]} = setVec4Alpha(${inputs[0]}, ${inputs[1]}, ${isPremultiplied});`;
      },
    },
    webgl2: {
      dependency: `vec4 setVec4Alpha(vec4 color, float alpha, bool isPremultiplied) {
    vec3 rgb = color.rgb;
    
    // If input is premultiplied, unpremultiply it first
    if (isPremultiplied && color.a > 0.0001) {
        rgb = rgb / color.a;
    }
    
    // Set new alpha and premultiply
    return vec4(rgb * alpha, alpha);
}`,
      execution: (inputs, outputs, node) => {
        const isPremultiplied =
          node.operation === "premultiplied" ? "true" : "false";
        return `    vec4 ${outputs[0]} = setVec4Alpha(${inputs[0]}, ${inputs[1]}, ${isPremultiplied});`;
      },
    },
    webgpu: {
      dependency: `fn setVec4Alpha(color: vec4<f32>, alpha: f32, isPremultiplied: bool) -> vec4<f32> {
    var rgb = color.rgb;
    
    // If input is premultiplied, unpremultiply it first
    if (isPremultiplied && color.a > 0.0001) {
        rgb = rgb / color.a;
    }
    
    // Set new alpha and premultiply
    return vec4<f32>(rgb * alpha, alpha);
}`,
      execution: (inputs, outputs, node) => {
        const isPremultiplied =
          node.operation === "premultiplied" ? "true" : "false";
        return `    var ${outputs[0]}: vec4<f32> = setVec4Alpha(${inputs[0]}, ${inputs[1]}, ${isPremultiplied});`;
      },
    },
  },
  "Color",
  [
    "alpha",
    "transparency",
    "premultiply",
    "vec4",
    "rgba",
    "opacity",
    "set alpha",
  ]
);

// Add operation options to the node type
SetVec4AlphaNode.hasOperation = true;
SetVec4AlphaNode.operationOptions = [
  { value: "premultiplied", label: "Premultiplied" },
  { value: "unpremultiplied", label: "Unpremultiplied" },
];
