import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// getLayoutPos, corrected for frames that C3 packed rotated into a spritesheet.
//
// The plain getLayoutPos maps texture UV onto the layout rect one axis at a
// time. That silently assumes the texture axes line up with the object's, and
// for a rotated frame they do not: srcOrigin is the frame's *transposed* box in
// the sheet and the quad's texture coords are rotated to compensate, so the
// result comes out turned 90 degrees and scaled by the frame's aspect ratio.
// Anything built on absolute layout geometry - a pixellation grid, a direction,
// a world-space noise lookup - is then wrong, even though the image itself
// still looks right (fromLayoutPos inverts the same wrong map).
//
// WebGL needs no correction and gets none: C3 forces a pre-draw whenever a
// shader reads a src rect or pixelSize and the source texture is rotated, so
// the texture WebGL samples is always axis-aligned. WebGPU has no such rule -
// it exposes c3Params.isSrcTexRotated and expects the shader to handle it,
// which is what the WGSL below does. Naming the uniform is also what makes C3
// wire it up at all (it only sets it if the source mentions it).
//
// ONLY CORRECT ON THE FAST PATH. C3 sets isSrcTexRotated in _Render_FastPath
// and _SetFirstBounceProgramParameters, and nowhere else - a Bounce step
// inherits whatever was last written. So in any chain that pre-draws, or for
// any effect that is not the first on the object, the flag is stale while the
// texture being sampled is an axis-aligned temp surface. Use these nodes for a
// single, fast-path effect; for anything else set mustPredraw instead, which
// resolves the frame upright before the shader ever runs.
const ROTATION_SAFE_NORM_WGSL = `fn c3sg_srcOriginToObjectNorm(p : vec2<f32>) -> vec2<f32>
{
	let n = (p - c3Params.srcOriginStart) / (c3Params.srcOriginEnd - c3Params.srcOriginStart);

	// A rotated frame is stored with its corners turned anticlockwise
	// (ImageInfo.LoadStaticTexture -> Quad2D.rotatePointsAnticlockwise), which
	// maps object-normalised (x, y) onto texture-normalised (1 - y, x). This is
	// that inverted.
	if (c3Params.isSrcTexRotated != 0u)
	{
		return vec2<f32>(n.y, 1.0 - n.x);
	}

	return n;
}`;

const PLAIN_GLSL = (inputs, outputs) =>
  `    vec2 ${outputs[0]} = mix(layoutStart, layoutEnd, ((${inputs[0]} - srcOriginStart) / (srcOriginEnd - srcOriginStart)));`;

export const GetLayoutPosRotationSafeNode = new NodeType(
  "getLayoutPosWithRot",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: { dependency: "", execution: PLAIN_GLSL },
    webgl2: { dependency: "", execution: PLAIN_GLSL },
    webgpu: {
      dependency: ROTATION_SAFE_NORM_WGSL,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = mix(c3Params.layoutStart, c3Params.layoutEnd, c3sg_srcOriginToObjectNorm(${inputs[0]}));`,
    },
  },
  "Utility",
  ["layout", "position", "coordinates", "rotated", "spritesheet", "safe"],
);
