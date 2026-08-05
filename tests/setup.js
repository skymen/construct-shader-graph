// Vitest setup: stub browser APIs jsdom doesn't ship, then install the
// phantom-wire invariant check that runs after every test.
// Runs once per test file before any imports execute.

import { afterEach } from "vitest";
import { installDomStubs } from "../headless/dom-stubs.js";

installDomStubs(window, globalThis);

// Silence noisy logs during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  const noop = () => {};
  // Keep error/warn but mute log/info/debug
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

// --- Phantom-wire invariant check --------------------------------------------
// After every test, walk the blueprint's graphs and assert wire/port integrity:
//   1. Every wire in a graph's `wires` list is referenced by both endpoints'
//      `port.connections` arrays AND both endpoints' nodes belong to that graph.
//   2. Every wire referenced by any `port.connections` is present in its
//      owning graph's `wires` list.
// A violation of either direction is a phantom wire: it appears in one place
// but not the other, and codegen vs. UI will disagree about whether it exists.
//
// Skip when no blueprint is present (e.g., pure unit tests that don't bootstrap).
export function assertNoPhantomWires(bp) {
  if (!bp || !bp.graphs) return;

  // Index every wire → the graph that claims to own it (via graph.wires).
  const wireToGraph = new Map();
  for (const graph of bp.graphs.values()) {
    for (const wire of graph.wires || []) {
      if (wireToGraph.has(wire)) {
        throw new Error(
          `Phantom wire: same wire in two graphs' wires lists`
        );
      }
      wireToGraph.set(wire, graph);
    }
  }

  // Direction 1: every wire in a graph's list must be referenced by both ports.
  for (const [wire, graph] of wireToGraph) {
    const { startPort, endPort } = wire;
    if (!startPort || !endPort) {
      throw new Error(`Phantom wire in graph "${graph.name || graph.id}": wire has null endpoint(s)`);
    }
    if (!startPort.connections.includes(wire)) {
      throw new Error(
        `Phantom wire in graph "${graph.name || graph.id}": wire is in graph.wires but startPort.connections does not include it`
      );
    }
    if (!endPort.connections.includes(wire)) {
      throw new Error(
        `Phantom wire in graph "${graph.name || graph.id}": wire is in graph.wires but endPort.connections does not include it`
      );
    }
  }

  // Direction 2: every wire referenced by a port.connections must be in some
  // graph's wires list — specifically, the graph the port's node lives in.
  for (const graph of bp.graphs.values()) {
    for (const node of graph.nodes || []) {
      const allPorts = [...(node.inputPorts || []), ...(node.outputPorts || [])];
      for (const port of allPorts) {
        for (const wire of port.connections || []) {
          const owner = wireToGraph.get(wire);
          if (!owner) {
            throw new Error(
              `Phantom wire in graph "${graph.name || graph.id}": port "${port.name}" on node ${node.id} references a wire not in any graph.wires`
            );
          }
          if (owner !== graph) {
            throw new Error(
              `Phantom wire: port "${port.name}" on node ${node.id} (graph "${graph.name || graph.id}") references a wire owned by a different graph ("${owner.name || owner.id}")`
            );
          }
        }
      }
    }
  }
}

afterEach(() => {
  const bp = globalThis.__bp;
  if (!bp) return;
  assertNoPhantomWires(bp);
});
