// Export all node types
export { NodeType } from "./NodeType.js";
export { PORT_TYPES } from "./PortTypes.js";

// Import all node types
import { MathNode } from "./MathNode.js";
import { VectorNode } from "./VectorNode.js";
import { ColorNode } from "./ColorNode.js";
import { TextureNode } from "./TextureNode.js";
import { OutputNode } from "./OutputNode.js";
import { FloatVariableNode } from "./FloatVariableNode.js";
import { IntVariableNode } from "./IntVariableNode.js";
import { VectorVariableNode } from "./VectorVariableNode.js";
import { ColorVariableNode } from "./ColorVariableNode.js";
import { TextureVariableNode } from "./TextureVariableNode.js";

// Export NODE_TYPES object
export const NODE_TYPES = {
  math: MathNode,
  vector: VectorNode,
  color: ColorNode,
  texture: TextureNode,
  output: OutputNode,
  varFloat: FloatVariableNode,
  varInt: IntVariableNode,
  varVector: VectorVariableNode,
  varColor: ColorVariableNode,
  varTexture: TextureVariableNode,
};
