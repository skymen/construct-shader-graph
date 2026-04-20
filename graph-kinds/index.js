// graph-kinds/index.js
//
// Per-kind dispatch layer for function and loop-body graphs.
// Keeps Graph.js as pure storage and prevents kind logic from sprawling
// across script.js.

import { functionKindHandler } from "./function-kind.js";
import { loopBodyKindHandler } from "./loop-body-kind.js";

const handlers = {
  function: functionKindHandler,
  loopBody: loopBodyKindHandler,
};

/**
 * Get the handler for a graph kind.
 * @param {string} kind - 'main' | 'function' | 'loopBody'
 * @returns {object|null} The handler object, or null for 'main' (no handler needed)
 */
export function getHandler(kind) {
  return handlers[kind] || null;
}

/**
 * Build a directed graph of callable graphs (function/loopBody) where edges
 * represent "A calls B". Returns a Map<graphId, Set<graphId>> of dependencies.
 * @param {object} host - The BlueprintSystem host
 * @returns {Map<string, Set<string>>} Call DAG
 */
export function getCallDAG(host) {
  const dag = new Map();
  for (const graph of host.graphs.values()) {
    if (graph.kind === "function" || graph.kind === "loopBody") {
      dag.set(graph.id, new Set());
    }
  }
  // TODO: In Phase 3+, walk caller nodes in each graph to populate edges
  return dag;
}

/**
 * Check if adding a call from `fromGraphId` to `toGraphId` would create a cycle.
 * @param {object} host - The BlueprintSystem host
 * @param {string} fromGraphId - The graph that would contain the caller node
 * @param {string} toGraphId - The target graph being called
 * @returns {boolean} True if adding this edge would create a cycle
 */
export function wouldCreateCycle(host, fromGraphId, toGraphId) {
  // Direct self-call
  if (fromGraphId === toGraphId) return true;

  // Build current DAG and check if toGraphId can reach fromGraphId (would create cycle)
  const dag = getCallDAG(host);

  // Add the hypothetical edge
  if (!dag.has(fromGraphId)) dag.set(fromGraphId, new Set());
  dag.get(fromGraphId).add(toGraphId);

  // DFS from toGraphId to see if we can reach fromGraphId
  const visited = new Set();
  const stack = [toGraphId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromGraphId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = dag.get(current);
    if (deps) {
      for (const dep of deps) {
        stack.push(dep);
      }
    }
  }

  return false;
}
