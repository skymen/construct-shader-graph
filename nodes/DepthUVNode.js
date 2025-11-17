import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const DepthUVNode = new NodeType(
  "Depth UV",
  [],
  [{ name: "UV", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(destStart, destEnd, (vTex - srcStart) / (srcEnd - srcStart));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = mix(destStart, destEnd, (vTex - srcStart) / (srcEnd - srcStart));`,
    },
    webgpu: {
      dependency: ``,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_getDepthUV(input.fragPos.xy, textureDepth);`,
    },
  },
  "UV",
  [
    "uv",
    "coordinates",
    "texcoord",
    "depth",
    "vTex",
    "input.fragPos",
    "fragPos",
    "textureDepth",
  ]
);
