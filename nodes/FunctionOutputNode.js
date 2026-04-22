import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FunctionOutputNode = new NodeType(
  "Function Output",
  [], // inputs rebuilt dynamically by enforceBoundaryRules from the graph's contract
  [], // no outputs
  NODE_COLORS.functionBoundary,
  {
    webgl1: { dependency: "", execution: null },
    webgl2: { dependency: "", execution: null },
    webgpu: { dependency: "", execution: null },
  },
  "Functions",
  ["function output", "subgraph output", "return", "result"]
);

FunctionOutputNode.requiresFunctionContext = true;
FunctionOutputNode.uniqueWithinGraph = true;
FunctionOutputNode.undeleteable = true;
