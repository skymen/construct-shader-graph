import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FrontUVNode = new NodeType(
  "Front UV",
  [],
  [{ name: "UV", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = vTex;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    vec2 ${outputs[0]} = vTex;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = input.fragUV;`,
    },
  },
  "UV",
  [
    "uv",
    "coordinates",
    "texcoord",
    "front",
    "vTex",
    "fragUV",
    "input.fragUV",
    "textureFront",
  ]
);
