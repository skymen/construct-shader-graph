import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// The source rectangle's size in real pixels.
//
// srcOriginSize is measured in texture coordinates, which say nothing about
// shape on their own - a 16x512 sprite packed into a square spritesheet has a
// srcOriginSize whose two components are not comparable. Dividing by pixelSize
// converts to pixels, which is what you need for an aspect ratio.
//
// C3 keeps pixelSize consistent with srcOrigin on every render path: on the
// fast path both refer to the spritesheet, on the pre-draw/bounce paths both
// refer to the temporary surface. So this is the frame's pixel size either way.
export const SrcOriginPixelSizeNode = new NodeType(
  "srcOriginPixelSize",
  [],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    highmedp vec2 ${outputs[0]} = abs(srcOriginEnd - srcOriginStart) / max(pixelSize, vec2(0.00001));`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    highmedp vec2 ${outputs[0]} = abs(srcOriginEnd - srcOriginStart) / max(pixelSize, vec2(0.00001));`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = abs(c3Params.srcOriginEnd - c3Params.srcOriginStart) / max(c3_getPixelSize(textureFront), vec2<f32>(0.00001));`,
    },
  },
  "Builtin",
  [
    "source",
    "origin",
    "size",
    "pixels",
    "dimensions",
    "width",
    "height",
    "aspect",
  ]
);
