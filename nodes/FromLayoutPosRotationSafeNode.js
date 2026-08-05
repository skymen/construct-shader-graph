import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// fromLayoutPos, corrected for frames that C3 packed rotated into a
// spritesheet. The inverse of getLayoutPos (Rotation Safe) - see that node for
// why the correction is needed, why WebGL does not get one, and why both are
// only valid for a single effect on C3's fast path.
const ROTATION_SAFE_SRC_WGSL = `fn c3sg_objectNormToSrcOrigin(o : vec2<f32>) -> vec2<f32>
{
	var n = o;

	// Object-normalised (x, y) sits at texture-normalised (1 - y, x) once the
	// frame's corners have been turned anticlockwise in the sheet.
	if (c3Params.isSrcTexRotated != 0u)
	{
		n = vec2<f32>(1.0 - o.y, o.x);
	}

	return mix(c3Params.srcOriginStart, c3Params.srcOriginEnd, n);
}`;

const PLAIN_GLSL = (inputs, outputs) =>
  `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, ((${inputs[0]} - layoutStart) / (layoutEnd - layoutStart)));`;

export const FromLayoutPosRotationSafeNode = new NodeType(
  "fromLayoutPosWithRot",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: { dependency: "", execution: PLAIN_GLSL },
    webgl2: { dependency: "", execution: PLAIN_GLSL },
    webgpu: {
      dependency: ROTATION_SAFE_SRC_WGSL,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3sg_objectNormToSrcOrigin((${inputs[0]} - c3Params.layoutStart) / (c3Params.layoutEnd - c3Params.layoutStart));`,
    },
  },
  "Utility",
  [
    "layout",
    "position",
    "coordinates",
    "source",
    "origin",
    "rotated",
    "spritesheet",
    "safe",
  ],
);
