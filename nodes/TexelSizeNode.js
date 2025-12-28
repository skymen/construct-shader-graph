import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const TexelSizeNode = new NodeType(
  "texelSize",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mediump vec2 ${outputs[0]} = abs(srcOriginEnd-srcOriginStart)/abs(layoutEnd-layoutStart);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mediump vec2 ${outputs[0]} = abs(srcOriginEnd-srcOriginStart)/abs(layoutEnd-layoutStart);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = abs(c3Params.srcOriginEnd-c3Params.srcOriginStart)/abs(c3Params.layoutEnd-c3Params.layoutStart);`,
    },
  },
  "Builtin",
  ["texel", "size", "pixel", "uv", "texture"]
);
