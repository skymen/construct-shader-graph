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
    dag.set(graph.id, new Set());
  }
  for (const graph of host.graphs.values()) {
    for (const node of graph.nodes) {
      if (node.nodeType.isFunctionCall && node.nodeType.targetGraphId) {
        const deps = dag.get(graph.id);
        if (deps) deps.add(node.nodeType.targetGraphId);
      }
    }
  }
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

/**
 * Return a human-readable cycle path string if adding fromGraphId→toGraphId
 * would create a cycle, or null if no cycle.
 */
export function getCyclePath(host, fromGraphId, toGraphId) {
  if (fromGraphId === toGraphId) {
    const g = host.graphs.get(fromGraphId);
    const name = g?.name || fromGraphId;
    return `${name} → ${name}`;
  }

  const dag = getCallDAG(host);
  if (!dag.has(fromGraphId)) dag.set(fromGraphId, new Set());
  dag.get(fromGraphId).add(toGraphId);

  // BFS from toGraphId to find path back to fromGraphId
  const parent = new Map();
  const queue = [toGraphId];
  parent.set(toGraphId, null);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === fromGraphId) {
      const path = [];
      let node = fromGraphId;
      path.push(fromGraphId);
      path.push(toGraphId);
      let cursor = toGraphId;
      while (cursor !== fromGraphId) {
        const next = parent.get(cursor);
        if (next === null || next === undefined) break;
        if (next !== fromGraphId) path.push(next);
        cursor = next;
      }
      return path.map((id) => host.graphs.get(id)?.name || id).join(" → ");
    }
    const deps = dag.get(current);
    if (deps) {
      for (const dep of deps) {
        if (!parent.has(dep)) {
          parent.set(dep, current);
          queue.push(dep);
        }
      }
    }
  }

  return null;
}

/**
 * Detect any cycle in the existing call DAG (no hypothetical edge).
 * Returns an array of graph IDs forming the cycle, or null if acyclic.
 */
export function detectCycleInDAG(host) {
  const dag = getCallDAG(host);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();

  for (const id of dag.keys()) color.set(id, WHITE);

  for (const startId of dag.keys()) {
    if (color.get(startId) !== WHITE) continue;

    const stack = [{ id: startId, iter: null }];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame.iter) frame.iter = (dag.get(frame.id) || new Set()).values();

      const next = frame.iter.next();
      if (next.done) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }

      const neighbor = next.value;
      if (color.get(neighbor) === GRAY) {
        const cycle = [neighbor];
        for (let i = stack.length - 1; i >= 0; i--) {
          cycle.push(stack[i].id);
          if (stack[i].id === neighbor) break;
        }
        return cycle.reverse();
      }
      if (color.get(neighbor) === WHITE) {
        color.set(neighbor, GRAY);
        parent.set(neighbor, frame.id);
        stack.push({ id: neighbor, iter: null });
      }
    }
  }

  return null;
}
