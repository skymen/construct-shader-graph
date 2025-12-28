import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const LayoutPixelSizeNode = new NodeType(
  "layoutPixelSize",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mediump vec2 ${outputs[0]} = abs(layoutEnd-layoutStart)/abs(destEnd-destStart);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    mediump vec2 ${outputs[0]} = abs(layoutEnd-layoutStart)/abs(destEnd-destStart);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = abs(c3Params.layoutEnd-c3Params.layoutStart)/abs(c3Params.destEnd-c3Params.destStart);`,
    },
  },
  "Builtin",
  ["layout", "pixel", "size", "dimensions"]
);
