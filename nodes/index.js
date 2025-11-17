// Export all node types
export { NodeType } from "./NodeType.js";
export {
  PORT_TYPES,
  areTypesCompatible,
  isGenericType,
  getAllowedTypesForGeneric,
  toShaderValue,
  toWGSLType,
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
import { SignNode } from "./SignNode.js";
import { SelectNode } from "./SelectNode.js";
import { ToFloatNode } from "./ToFloatNode.js";
import { ToIntNode } from "./ToIntNode.js";
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
import { CrossNode } from "./CrossNode.js";
import { NormalizeNode } from "./NormalizeNode.js";
import { LengthNode } from "./LengthNode.js";
import { DistanceNode } from "./DistanceNode.js";
import { MultiplyVectorNode } from "./MultiplyVectorNode.js";
import { RotateAroundPointNode } from "./RotateAroundPointNode.js";
import { Hash11Node } from "./Hash11Node.js";
import { Hash21Node } from "./Hash21Node.js";
import { Hash22Node } from "./Hash22Node.js";
import { Hash33Node } from "./Hash33Node.js";
import { ValueNoiseNode } from "./ValueNoiseNode.js";
import { PerlinNoiseNode } from "./PerlinNoiseNode.js";
import { SimplexNoiseNode } from "./SimplexNoiseNode.js";
import { VoronoiNoiseNode } from "./VoronoiNoiseNode.js";
import { FBMNode } from "./FBMNode.js";
import { Vec2Node } from "./Vec2Node.js";
import { Vec3Node } from "./Vec3Node.js";
import { Vec4Node } from "./Vec4Node.js";
import { Vec2DecomposeNode } from "./Vec2DecomposeNode.js";
import { Vec3DecomposeNode } from "./Vec3DecomposeNode.js";
import { Vec4DecomposeNode } from "./Vec4DecomposeNode.js";
import { ColorDecomposeNode } from "./ColorDecomposeNode.js";
import { LinearGradientNode } from "./LinearGradientNode.js";
import { RadialGradientNode } from "./RadialGradientNode.js";
import { TextureFrontNode } from "./TextureFrontNode.js";
import { TextureBackNode } from "./TextureBackNode.js";
import { TextureDepthNode } from "./TextureDepthNode.js";
import { SamplerFrontNode } from "./SamplerFrontNode.js";
import { SamplerBackNode } from "./SamplerBackNode.js";
import { SamplerDepthNode } from "./SamplerDepthNode.js";
import { TextureSampleNode } from "./TextureSampleNode.js";
import { TextureSampleLODNode } from "./TextureSampleLODNode.js";
import { TextureSampleGradNode } from "./TextureSampleGradNode.js";
import { FrontUVNode } from "./FrontUVNode.js";
import { BackUVNode } from "./BackUVNode.js";
import { DepthUVNode } from "./DepthUVNode.js";
import { OutputNode } from "./OutputNode.js";
import { WrapUVNode } from "./WrapUVNode.js";
import { ScaleUVNode } from "./ScaleUVNode.js";
import { TilingNode } from "./TilingNode.js";
import { TwirlNode } from "./TwirlNode.js";
import { FlipNode } from "./FlipNode.js";
import { RemapNode } from "./RemapNode.js";
import { DDXNode } from "./DDXNode.js";
import { DDYNode } from "./DDYNode.js";
import { FWidthNode } from "./FWidthNode.js";
import { PolarToCartesianNode } from "./PolarToCartesianNode.js";
import { CartesianToPolarNode } from "./CartesianToPolarNode.js";
import { SphericalToCartesianNode } from "./SphericalToCartesianNode.js";
import { CartesianToSphericalNode } from "./CartesianToSphericalNode.js";
import { SwizzleNode } from "./SwizzleNode.js";
import { AppendVec3Node } from "./AppendVec3Node.js";
import { AppendVec4Node } from "./AppendVec4Node.js";

// Import debug nodes
import { ShaderLanguageTestNode } from "./ShaderLanguageTestNode.js";

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
import { BuiltinSrcSizeNode } from "./BuiltinSrcSizeNode.js";
import { BuiltinSrcCenterNode } from "./BuiltinSrcCenterNode.js";
import { BuiltinSrcOriginSizeNode } from "./BuiltinSrcOriginSizeNode.js";
import { BuiltinSrcOriginCenterNode } from "./BuiltinSrcOriginCenterNode.js";
import { BuiltinDestCenterNode } from "./BuiltinDestCenterNode.js";
import { BuiltinDestSizeNode } from "./BuiltinDestSizeNode.js";
import { BuiltinLayoutCenterNode } from "./BuiltinLayoutCenterNode.js";
import { BuiltinLayoutSizeNode } from "./BuiltinLayoutSizeNode.js";
import { TexelSizeNode } from "./TexelSizeNode.js";
import { PixelSizeNode } from "./PixelSizeNode.js";
import { LayoutPixelSizeNode } from "./LayoutPixelSizeNode.js";
import { SrcOriginToNormNode } from "./SrcOriginToNormNode.js";
import { GetLayoutPosNode } from "./GetLayoutPosNode.js";
import { UnpremultiplyNode } from "./UnpremultiplyNode.js";
import { PremultiplyNode } from "./PremultiplyNode.js";
import { LinearizeDepthNode } from "./LinearizeDepthNode.js";
import { SrcToNormNode } from "./SrcToNormNode.js";
import { NormToSrcNode } from "./NormToSrcNode.js";
import { NormToSrcOriginNode } from "./NormToSrcOriginNode.js";
import { ClampToSrcNode } from "./ClampToSrcNode.js";
import { ClampToSrcOriginNode } from "./ClampToSrcOriginNode.js";
import { SrcToDestNode } from "./SrcToDestNode.js";
import { ClampToDestNode } from "./ClampToDestNode.js";
import { GrayscaleNode } from "./GrayscaleNode.js";
import { RGBtoHSLNode } from "./RGBtoHSLNode.js";
import { HSLtoRGBNode } from "./HSLtoRGBNode.js";

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
  sqrt: SqrtNode,
  exp: ExpNode,
  ln: LnNode,
  log10: Log10Node,
  log2: Log2Node,
  exp2: Exp2Node,
  exp10: Exp10Node,
  sign: SignNode,
  select: SelectNode,
  toFloat: ToFloatNode,
  toInt: ToIntNode,
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
  cross: CrossNode,
  normalize: NormalizeNode,
  length: LengthNode,
  distance: DistanceNode,
  multiplyVector: MultiplyVectorNode,
  rotateAroundPoint: RotateAroundPointNode,
  hash11: Hash11Node,
  hash21: Hash21Node,
  hash22: Hash22Node,
  hash33: Hash33Node,
  valueNoise: ValueNoiseNode,
  perlinNoise: PerlinNoiseNode,
  simplexNoise: SimplexNoiseNode,
  voronoiNoise: VoronoiNoiseNode,
  fbm: FBMNode,
  vec2: Vec2Node,
  vec3: Vec3Node,
  vec4: Vec4Node,
  vec2Decompose: Vec2DecomposeNode,
  vec3Decompose: Vec3DecomposeNode,
  vec4Decompose: Vec4DecomposeNode,
  colorDecompose: ColorDecomposeNode,
  linearGradient: LinearGradientNode,
  radialGradient: RadialGradientNode,
  textureFront: TextureFrontNode,
  textureBack: TextureBackNode,
  textureDepth: TextureDepthNode,
  samplerFront: SamplerFrontNode,
  samplerBack: SamplerBackNode,
  samplerDepth: SamplerDepthNode,
  textureSample: TextureSampleNode,
  textureSampleLOD: TextureSampleLODNode,
  textureSampleGrad: TextureSampleGradNode,
  frontUV: FrontUVNode,
  backUV: BackUVNode,
  depthUV: DepthUVNode,
  output: OutputNode,
  wrapUV: WrapUVNode,
  scaleUV: ScaleUVNode,
  tiling: TilingNode,
  twirl: TwirlNode,
  flip: FlipNode,
  remap: RemapNode,
  ddx: DDXNode,
  ddy: DDYNode,
  fwidth: FWidthNode,
  polarToCartesian: PolarToCartesianNode,
  cartesianToPolar: CartesianToPolarNode,
  sphericalToCartesian: SphericalToCartesianNode,
  cartesianToSpherical: CartesianToSphericalNode,
  swizzle: SwizzleNode,
  appendVec3: AppendVec3Node,
  appendVec4: AppendVec4Node,

  // Built-in parameters
  builtinSrcStart: BuiltinSrcStartNode,
  builtinSrcEnd: BuiltinSrcEndNode,
  builtinSrcSize: BuiltinSrcSizeNode,
  builtinSrcCenter: BuiltinSrcCenterNode,
  builtinSrcOriginStart: BuiltinSrcOriginStartNode,
  builtinSrcOriginEnd: BuiltinSrcOriginEndNode,
  builtinSrcOriginSize: BuiltinSrcOriginSizeNode,
  builtinSrcOriginCenter: BuiltinSrcOriginCenterNode,
  builtinLayoutStart: BuiltinLayoutStartNode,
  builtinLayoutEnd: BuiltinLayoutEndNode,
  builtinLayoutCenter: BuiltinLayoutCenterNode,
  builtinLayoutSize: BuiltinLayoutSizeNode,
  builtinDestStart: BuiltinDestStartNode,
  builtinDestEnd: BuiltinDestEndNode,
  builtinDestCenter: BuiltinDestCenterNode,
  builtinDestSize: BuiltinDestSizeNode,
  builtinDevicePixelRatio: BuiltinDevicePixelRatioNode,
  builtinLayerScale: BuiltinLayerScaleNode,
  builtinLayerAngle: BuiltinLayerAngleNode,
  builtinSeconds: BuiltinSecondsNode,
  builtinZNear: BuiltinZNearNode,
  builtinZFar: BuiltinZFarNode,
  texelSize: TexelSizeNode,
  pixelSize: PixelSizeNode,
  layoutPixelSize: LayoutPixelSizeNode,
  srcOriginToNorm: SrcOriginToNormNode,
  getLayoutPos: GetLayoutPosNode,
  unpremultiply: UnpremultiplyNode,
  premultiply: PremultiplyNode,
  linearizeDepth: LinearizeDepthNode,
  srcToNorm: SrcToNormNode,
  normToSrc: NormToSrcNode,
  normToSrcOrigin: NormToSrcOriginNode,
  clampToSrc: ClampToSrcNode,
  clampToSrcOrigin: ClampToSrcOriginNode,
  srcToDest: SrcToDestNode,
  clampToDest: ClampToDestNode,
  grayscale: GrayscaleNode,
  rgbToHsl: RGBtoHSLNode,
  hslToRgb: HSLtoRGBNode,

  // Debug nodes
  shaderLanguageTest: ShaderLanguageTestNode,
};
