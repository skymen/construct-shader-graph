import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import {
  EDGE_OPTIONS,
  buildEdgeSampledTexture,
} from "./textureEdgeSampling.js";

export const TextureFrontNode = new NodeType(
  "Front Texture",
  [{ name: "UV", type: "vec2" }],
  [
    { name: "RGBA", type: "vec4" },
    { name: "Color", type: "vec3" },
    { name: "Alpha", type: "float" },
  ],
  NODE_COLORS.textureSamplePreset,
  buildEdgeSampledTexture({
    glsl: {
      start: "srcOriginStart",
      end: "srcOriginEnd",
      texel: "pixelSize",
      sampleWebgl1: (uv) => `texture2D(samplerFront, ${uv})`,
      sampleWebgl2: (uv) => `texture(samplerFront, ${uv})`,
    },
    wgsl: {
      start: "c3Params.srcOriginStart",
      end: "c3Params.srcOriginEnd",
      texel: "c3_getPixelSize(textureFront)",
      sample: (uv) => `textureSample(textureFront, samplerFront, ${uv})`,
    },
  }),
  "Texture",
  [
    "sample",
    "front",
    "layer",
    "texture",
    "sample2d",
    "clip",
    "clamp",
    "bleed",
    "spritesheet",
    "atlas",
    "bounds",
  ]
);

TextureFrontNode.hasOperation = true;
TextureFrontNode.operationOptions = EDGE_OPTIONS;

TextureFrontNode.manual = {
  description:
    "Samples the object's own texture. The Edge mode controls what happens when the UV leaves the current animation frame — leave it on Raw unless a distortion can push coordinates off the frame, in which case Clip is almost always what you want.",
  html: `
    <h4>Edge modes</h4>
    <ul>
      <li><strong>Raw</strong> — sample wherever the UV points. Fastest, and correct when the UV cannot leave the frame.</li>
      <li><strong>Clamp</strong> — pin out-of-bounds UVs to the frame edge, so they return the border pixel smeared outward.</li>
      <li><strong>Clip</strong> — return fully transparent outside the frame.</li>
    </ul>

    <h4>The bug Clamp and Clip exist to fix</h4>
    <p>
      On C3's fast path <code>samplerFront</code> is the whole spritesheet, and the current frame
      is just a rect inside it. A UV distortion that leaves that rect samples whatever sprite the
      atlas packer happened to place next door — blocks of unrelated colour. Because it depends
      on packing, the same project can look right on one machine and wrong on another.
    </p>
    <p>
      Both Clamp and Clip also inset the sample by half a texel. That matters more than it
      sounds: the frame boundary sits on a texel edge, so a bilinear tap at exactly the boundary
      blends 50/50 with the neighbouring sprite. Clamping to the exact rect is <em>not</em>
      enough to stop bleed — the inset is what stops it.
    </p>

    <h4>Choosing between them</h4>
    <ul>
      <li>Distortions that should fade out at the frame edge → <strong>Clip</strong></li>
      <li>Blurs and offsets that should keep a solid edge → <strong>Clamp</strong></li>
    </ul>

    <div class="tip">
      Clip masks colour alongside alpha, which is what C3's premultiplied-alpha pipeline expects.
      Masking alpha alone produces bright fringes.
    </div>

    <div class="warning">
      <strong>Rotated spritesheet frames.</strong> C3 may rotate a frame 90&deg; when packing it.
      The bounds come from srcOrigin, which is texture-space, so on a rotated frame they are
      correct but no longer aligned with the sprite's own axes. Set <code>mustPredraw</code> in
      the addon config if your effect must see an upright frame.
    </div>
  `,
};
