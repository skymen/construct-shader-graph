// Export all node types
export { NodeType } from "./NodeType.js";
export {
  PORT_TYPES,
  areTypesCompatible,
  isGenericType,
  getAllowedTypesForGeneric,
  toShaderValue,
} from "./PortTypes.js";

// Import all node types
import { MathNode } from "./MathNode.js";
import { PowerNode } from "./PowerNode.js";
import { AbsNode } from "./AbsNode.js";
import { RoundNode } from "./RoundNode.js";
import { FractNode } from "./FractNode.js";
import { FloorNode } from "./FloorNode.js";
import { CeilNode } from "./CeilNode.js";
import { ModNode } from "./ModNode.js";
import { SqrtNode } from "./SqrtNode.js";
import { ExpNode } from "./ExpNode.js";
import { LnNode } from "./LnNode.js";
import { Log10Node } from "./Log10Node.js";
import { Log2Node } from "./Log2Node.js";
import { Exp2Node } from "./Exp2Node.js";
import { Exp10Node } from "./Exp10Node.js";
import { CompareNode } from "./CompareNode.js";
import { MinNode } from "./MinNode.js";
import { MaxNode } from "./MaxNode.js";
import { ClampNode } from "./ClampNode.js";
import { MixNode } from "./MixNode.js";
import { StepNode } from "./StepNode.js";
import { SmoothstepNode } from "./SmoothstepNode.js";
import { CosNode } from "./CosNode.js";
import { SinNode } from "./SinNode.js";
import { TanNode } from "./TanNode.js";
import { AsinNode } from "./AsinNode.js";
import { AcosNode } from "./AcosNode.js";
import { AtanNode } from "./AtanNode.js";
import { Atan2Node } from "./Atan2Node.js";
import { ToDegreesNode } from "./ToDegreesNode.js";
import { ToRadiansNode } from "./ToRadiansNode.js";
import { DotNode } from "./DotNode.js";
import { NormalizeNode } from "./NormalizeNode.js";
import { LengthNode } from "./LengthNode.js";
import { Vec2Node } from "./Vec2Node.js";
import { Vec3Node } from "./Vec3Node.js";
import { Vec4Node } from "./Vec4Node.js";
import { Vec2DecomposeNode } from "./Vec2DecomposeNode.js";
import { Vec3DecomposeNode } from "./Vec3DecomposeNode.js";
import { Vec4DecomposeNode } from "./Vec4DecomposeNode.js";
import { TextureFrontNode } from "./TextureFrontNode.js";
import { TextureBackNode } from "./TextureBackNode.js";
import { TextureDepthNode } from "./TextureDepthNode.js";
import { FrontUVNode } from "./FrontUVNode.js";
import { BackUVNode } from "./BackUVNode.js";
import { DepthUVNode } from "./DepthUVNode.js";
import { OutputNode } from "./OutputNode.js";

// Import built-in parameter nodes
import { BuiltinSrcStartNode } from "./BuiltinSrcStartNode.js";
import { BuiltinSrcEndNode } from "./BuiltinSrcEndNode.js";
import { BuiltinSrcOriginStartNode } from "./BuiltinSrcOriginStartNode.js";
import { BuiltinSrcOriginEndNode } from "./BuiltinSrcOriginEndNode.js";
import { BuiltinLayoutStartNode } from "./BuiltinLayoutStartNode.js";
import { BuiltinLayoutEndNode } from "./BuiltinLayoutEndNode.js";
import { BuiltinDestStartNode } from "./BuiltinDestStartNode.js";
import { BuiltinDestEndNode } from "./BuiltinDestEndNode.js";
import { BuiltinDevicePixelRatioNode } from "./BuiltinDevicePixelRatioNode.js";
import { BuiltinLayerScaleNode } from "./BuiltinLayerScaleNode.js";
import { BuiltinLayerAngleNode } from "./BuiltinLayerAngleNode.js";
import { BuiltinSecondsNode } from "./BuiltinSecondsNode.js";
import { BuiltinZNearNode } from "./BuiltinZNearNode.js";
import { BuiltinZFarNode } from "./BuiltinZFarNode.js";

// Export NODE_TYPES object
export const NODE_TYPES = {
  math: MathNode,
  power: PowerNode,
  abs: AbsNode,
  round: RoundNode,
  fract: FractNode,
  floor: FloorNode,
  ceil: CeilNode,
  mod: ModNode,
  fmod: FmodNode,
  sqrt: SqrtNode,
  exp: ExpNode,
  ln: LnNode,
  log10: Log10Node,
  log2: Log2Node,
  exp2: Exp2Node,
  exp10: Exp10Node,
  compare: CompareNode,
  min: MinNode,
  max: MaxNode,
  clamp: ClampNode,
  mix: MixNode,
  step: StepNode,
  smoothstep: SmoothstepNode,
  cos: CosNode,
  sin: SinNode,
  tan: TanNode,
  asin: AsinNode,
  acos: AcosNode,
  atan: AtanNode,
  atan2: Atan2Node,
  toDegrees: ToDegreesNode,
  toRadians: ToRadiansNode,
  dot: DotNode,
  normalize: NormalizeNode,
  length: LengthNode,
  vec2: Vec2Node,
  vec3: Vec3Node,
  vec4: Vec4Node,
  vec2Decompose: Vec2DecomposeNode,
  vec3Decompose: Vec3DecomposeNode,
  vec4Decompose: Vec4DecomposeNode,
  textureFront: TextureFrontNode,
  textureBack: TextureBackNode,
  textureDepth: TextureDepthNode,
  frontUV: FrontUVNode,
  backUV: BackUVNode,
  depthUV: DepthUVNode,
  output: OutputNode,

  // Built-in parameters
  builtinSrcStart: BuiltinSrcStartNode,
  builtinSrcEnd: BuiltinSrcEndNode,
  builtinSrcOriginStart: BuiltinSrcOriginStartNode,
  builtinSrcOriginEnd: BuiltinSrcOriginEndNode,
  builtinLayoutStart: BuiltinLayoutStartNode,
  builtinLayoutEnd: BuiltinLayoutEndNode,
  builtinDestStart: BuiltinDestStartNode,
  builtinDestEnd: BuiltinDestEndNode,
  builtinDevicePixelRatio: BuiltinDevicePixelRatioNode,
  builtinLayerScale: BuiltinLayerScaleNode,
  builtinLayerAngle: BuiltinLayerAngleNode,
  builtinSeconds: BuiltinSecondsNode,
  builtinZNear: BuiltinZNearNode,
  builtinZFar: BuiltinZFarNode,
};
