import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BackUVNode = new NodeType(
  "Back UV",
  [],
  [{ name: "UV", type: "vec2" }],
  NODE_COLORS.colorVec2,
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
        `    var ${outputs[0]}: vec2<f32> = c3_getBackUV(input.fragPos.xy, textureBack);`,
    },
  },
  "UV",
  [
    "uv",
    "coordinates",
    "texcoord",
    "back",
    "background",
    "vTex",
    "input.fragPos",
    "fragPos",
    "textureBack",
  ]
);
