// Export all node types
export { NodeType } from "./NodeType.js";
export { PORT_TYPES, areTypesCompatible } from "./PortTypes.js";

// Import all node types
import { MathNode } from "./MathNode.js";
import { PowerNode } from "./PowerNode.js";
import { AbsNode } from "./AbsNode.js";
import { CompareNode } from "./CompareNode.js";
import { Vec2Node } from "./Vec2Node.js";
import { VectorNode } from "./VectorNode.js";
import { ColorNode } from "./ColorNode.js";
import { TextureFrontNode } from "./TextureFrontNode.js";
import { TextureBackNode } from "./TextureBackNode.js";
import { TextureDepthNode } from "./TextureDepthNode.js";
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
  compare: CompareNode,
  vec2: Vec2Node,
  vector: VectorNode,
  color: ColorNode,
  textureFront: TextureFrontNode,
  textureBack: TextureBackNode,
  textureDepth: TextureDepthNode,
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
