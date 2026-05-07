import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FunctionInputNode = new NodeType(
  "Function Input",
  [], // no inputs
  [], // outputs rebuilt dynamically by enforceBoundaryRules from the graph's contract
  NODE_COLORS.functionBoundary,
  {
    webgl1: { dependency: "", execution: null },
    webgl2: { dependency: "", execution: null },
    webgpu: { dependency: "", execution: null },
  },
  "Functions",
  ["function input", "subgraph input", "entry", "parameters"]
);

// Hidden from the search menu when the active graph is 'main'.
FunctionInputNode.requiresFunctionContext = true;
// At most one per graph; a second add attempt is blocked.
FunctionInputNode.uniqueWithinGraph = true;
// Cannot be deleted by the user; the boundary node is owned by the graph.
FunctionInputNode.undeleteable = true;
