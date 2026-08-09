import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";
import {
  EDGE_OPTIONS,
  buildEdgeSampledTexture,
} from "./textureEdgeSampling.js";

export const TextureBackNode = new NodeType(
  "Back Texture",
  [{ name: "UV", type: "vec2" }],
  [
    { name: "RGBA", type: "vec4" },
    { name: "Color", type: "vec3" },
    { name: "Alpha", type: "float" },
  ],
  NODE_COLORS.textureSamplePreset,
  buildEdgeSampledTexture({
    // Back UV lives in dest space (see Back UV), not srcOrigin - the back
    // texture is the layout render surface, not the object's spritesheet.
    glsl: {
      start: "destStart",
      end: "destEnd",
      texel: null,
      sampleWebgl1: (uv) => `texture2D(samplerBack, ${uv})`,
      sampleWebgl2: (uv) => `texture(samplerBack, ${uv})`,
    },
    wgsl: {
      start: "c3Params.destStart",
      end: "c3Params.destEnd",
      texel: null,
      sample: (uv) => `textureSample(textureBack, samplerBack, ${uv})`,
    },
  }),
  "Texture",
  [
    "sample",
    "back",
    "layer",
    "background",
    "clip",
    "clamp",
    "bounds",
    "dest",
  ]
);

TextureBackNode.hasOperation = true;
TextureBackNode.operationOptions = EDGE_OPTIONS;

TextureBackNode.manual = {
  description:
    "Samples the background behind the object. The Edge mode controls what happens when the UV leaves the object's own rect on screen.",
  html: `
    <h4>Edge modes</h4>
    <ul>
      <li><strong>Raw</strong> — sample wherever the UV points, including outside the object's rect.</li>
      <li><strong>Clamp</strong> — pin out-of-bounds UVs to the rect edge.</li>
      <li><strong>Clip</strong> — return fully transparent outside the rect.</li>
    </ul>

    <h4>Bounds are dest, not srcOrigin</h4>
    <p>
      Back UV lives in destination space — <code>destStart</code> to <code>destEnd</code>, the
      object's rect on the layout render surface. That is a different space from the front
      texture's <code>srcOrigin</code>, so the two samplers' Edge modes are not interchangeable.
    </p>

    <h4>No half-texel inset here</h4>
    <p>
      Front Texture insets its clamp by half a texel because a tap at the frame boundary would
      blend with a neighbouring sprite in the spritesheet. The back texture is a render surface,
      not an atlas — a tap at its edge picks up ordinary neighbouring background, so there is
      nothing to guard against.
    </p>

    <div class="tip">
      Raw is often the <em>right</em> choice here. Background distortions such as refraction and
      heat haze are supposed to reach outside the object's rect; clamping them flattens the
      effect at the edges.
    </div>
  `,
};
