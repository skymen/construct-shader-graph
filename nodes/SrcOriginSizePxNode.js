import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// The source rectangle's size in real pixels.
//
// Named "SizePx", not "PixelSize", on purpose. pixelSize / texelSize /
// layoutPixelSize all mean "the size of one unit". This is the opposite: a size
// expressed *in* pixels. Reusing the PixelSize suffix here reads as a member of
// that family and means the wrong thing.
//
// srcOriginSize is measured in texture coordinates, which say nothing about
// shape on their own - a 16x512 sprite packed into a square spritesheet has a
// srcOriginSize whose two components are not comparable. Dividing by pixelSize
// converts to pixels, which is what you need for an aspect ratio.
//
// C3 keeps pixelSize consistent with srcOrigin on every render path: on the
// fast path both refer to the spritesheet, on the pre-draw/bounce paths both
// refer to the temporary surface. So this is the frame's pixel size either way.
export const SrcOriginSizePxNode = new NodeType(
  "srcOriginSizePx",
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

SrcOriginSizePxNode.manual = {
  description:
    "The current frame's size in real pixels, as a vec2 of width and height. This is the number you want for aspect ratios — srcOriginSize on its own is in texture coordinates and is not comparable across axes.",
  html: `
    <h4>Formula</h4>
    <pre><code>Value = abs(srcOriginEnd - srcOriginStart) / pixelSize</code></pre>

    <h4>Why not just use srcOriginSize?</h4>
    <p>
      <code>srcOriginSize</code> is in texture coordinates, which are relative to whatever
      spritesheet the frame happens to be packed into. A 16&times;512 sprite in a square sheet has
      a srcOriginSize whose two components mean different physical distances. Dividing by
      <code>pixelSize</code> converts both axes to the same unit.
    </p>

    <h4>Not to be confused with</h4>
    <ul>
      <li><code>pixelSize</code> — the size of <em>one</em> pixel in texture coords</li>
      <li><code>texelSize</code> — texture coords per layout unit</li>
      <li><code>layoutPixelSize</code> — layout units per device pixel</li>
    </ul>
    <p>Those three are "size of one unit". This one is "size measured in units".</p>

    <div class="tip">
      Consistent across render paths: C3 keeps <code>pixelSize</code> and <code>srcOrigin</code>
      referring to the same surface, whether drawing straight from the spritesheet or from a
      pre-draw / bounce surface.
    </div>

    <div class="warning">
      <strong>Rotated spritesheet frames.</strong> C3 may rotate a frame 90&deg; when packing it.
      srcOrigin is texture-space, so for a rotated frame the axes are swapped — width comes back
      as height and vice versa, and there is no uniform exposing the rotation. If your effect
      depends on frame orientation, set <code>mustPredraw</code> in the addon config to force
      C3 to draw through an upright temporary surface first.
    </div>
  `,
};
