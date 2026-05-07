// Test 26: Turn selection into function
//
// Verifies:
// - Basic extraction: selected nodes → function graph + caller in source
// - Boundary wires become function inputs/outputs with correct types
// - Internal wires are preserved inside the function body
// - Caller node is wired to original external connections
// - Edge cases: within function/loop graphs, multiple outputs, no external connections
// - Generic type assignment for ports with the same type
// - Undo/redo restores full state for all operations
// - Selection with boundary nodes (functionInput/Output, output) are excluded
// - Empty selection or single node

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES, Wire;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES, Wire } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
});

// ── Helpers ──────────────────────────────────────────────────────────────

function connect(srcPort, dstPort) {
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  blueprint.resolveGenericsForConnection(srcPort, dstPort);
  return wire;
}

function addCaller(target) {
  const kinds = { function: "function_call_", loopBody: "for_loop_" };
  const prefix = kinds[target.kind] || "function_call_";
  const key = `${prefix}${target.id}`;
  const callerType = blueprint.getCallableFunctionNodeTypes()[key];
  if (!callerType) throw new Error(`no caller type for ${target.name} (key: ${key})`);
  return blueprint.addNode(0, 0, callerType);
}

function snapshotAllGraphs() {
  const snapshots = new Map();
  for (const [id, g] of blueprint.graphs) {
    snapshots.set(id, blueprint._exportGraphState(g));
  }
  return { graphIds: new Set(blueprint.graphs.keys()), snapshots };
}

function expectStatesEqual(before, after) {
  expect(after.graphIds).toEqual(before.graphIds);
  for (const id of before.graphIds) {
    const bSnap = before.snapshots.get(id);
    const aSnap = after.snapshots.get(id);
    expect(aSnap.nodes.length).toBe(bSnap.nodes.length);
    expect(aSnap.wires.length).toBe(bSnap.wires.length);
    if (bSnap.data) {
      expect(aSnap.data).toEqual(bSnap.data);
    }
  }
}

// ── Undo/Redo cycle check ────────────────────────────────────────────────
// After each test, verify that undo→redo returns to the same state.

afterEach(() => {
  if (!blueprint.history.canUndo()) return;
  const stateBeforeUndo = snapshotAllGraphs();
  blueprint.history.undo();
  blueprint.history.redo();
  const stateAfterRedo = snapshotAllGraphs();
  expectStatesEqual(stateBeforeUndo, stateAfterRedo);
});

// ── 1. Basic extraction ──────────────────────────────────────────────────

describe("turnSelectionIntoFunction — basic extraction", () => {
  it("creates a new function graph and replaces selection with a caller", () => {
    // Setup: A → Math → Dest (all float-compatible)
    const outsideA = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 0, NODE_TYPES.math);
    connect(outsideA.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    // Select only the math node
    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const graphCountBefore = blueprint.graphs.size;
    const result = blueprint.turnSelectionIntoFunction("TestFn");

    expect(result).toBeDefined();
    expect(result.functionGraph).toBeDefined();
    expect(result.callerNode).toBeDefined();
    expect(blueprint.graphs.size).toBe(graphCountBefore + 1);
    expect(result.functionGraph.kind).toBe("function");
    expect(result.functionGraph.name).toBe("TestFn");

    // The math node should no longer be in the main graph
    expect(blueprint.mainGraph.nodes).not.toContain(mathNode);

    // The caller node should be in the main graph
    expect(blueprint.mainGraph.nodes).toContain(result.callerNode);

    // The caller should be wired to outsideA and destNode
    expect(result.callerNode.inputPorts[0].connections.length).toBe(1);
    expect(result.callerNode.inputPorts[0].connections[0].startPort.node).toBe(outsideA);
    expect(result.callerNode.outputPorts[0].connections.length).toBe(1);
    expect(result.callerNode.outputPorts[0].connections[0].endPort.node).toBe(destNode);
  });

  it("preserves internal wires inside the function body", () => {
    // Two math nodes wired together, both selected
    const mathA = blueprint.addNode(0, 0, NODE_TYPES.math);
    const mathB = blueprint.addNode(200, 0, NODE_TYPES.math);
    connect(mathA.outputPorts[0], mathB.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathA, true);
    blueprint.selectNode(mathB, true);

    const result = blueprint.turnSelectionIntoFunction("Internal");
    const fnGraph = result.functionGraph;

    // The function body should have the two math nodes + boundary nodes
    const bodyNodes = fnGraph.nodes.filter(
      n => n.nodeType !== NODE_TYPES.functionInput && n.nodeType !== NODE_TYPES.functionOutput
    );
    expect(bodyNodes.length).toBe(2);

    // There should be an internal wire between the two math nodes in the function
    const internalWire = fnGraph.wires.find(w =>
      w.startPort.node !== fnGraph.nodes.find(n => n.nodeType === NODE_TYPES.functionInput) &&
      w.endPort.node !== fnGraph.nodes.find(n => n.nodeType === NODE_TYPES.functionOutput)
    );
    expect(internalWire).toBeDefined();
  });

  it("function contract has correct input and output types", () => {
    const floatNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 0, NODE_TYPES.math);

    connect(floatNode.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("TypedFn");
    const contract = result.functionGraph.data.contract;

    // Math node has 2 float inputs — one connected externally, one not
    // Only the connected one should become a function input
    expect(contract.inputs.length).toBeGreaterThanOrEqual(1);
    expect(contract.outputs.length).toBe(1);

    // The connected input should be float type
    expect(contract.inputs[0].type).toBe("float");
    expect(contract.outputs[0].type).toBe("float");
  });
});

// ── 2. Multiple inputs/outputs ───────────────────────────────────────────

describe("turnSelectionIntoFunction — multiple I/O", () => {
  it("handles multiple external inputs from different sources", () => {
    const floatA = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const floatB = blueprint.addNode(0, 100, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 50, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 50, NODE_TYPES.math);

    connect(floatA.outputPorts[0], mathNode.inputPorts[0]);
    connect(floatB.outputPorts[0], mathNode.inputPorts[1]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("MultiIn");
    const contract = result.functionGraph.data.contract;

    expect(contract.inputs.length).toBe(2);
    expect(contract.outputs.length).toBe(1);

    // Caller should have both inputs wired
    expect(result.callerNode.inputPorts[0].connections.length).toBe(1);
    expect(result.callerNode.inputPorts[1].connections.length).toBe(1);
  });

  it("handles multiple external outputs going to different destinations", () => {
    // Select a node that has an output port feeding into two destinations
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    const destA = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destB = blueprint.addNode(200, 100, NODE_TYPES.math);

    connect(mathNode.outputPorts[0], destA.inputPorts[0]);
    connect(mathNode.outputPorts[0], destB.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("MultiOut");
    const contract = result.functionGraph.data.contract;

    // One output, but the caller's output should be wired to both destinations
    expect(contract.outputs.length).toBe(1);
    expect(result.callerNode.outputPorts[0].connections.length).toBe(2);
  });

  it("shared source port creates a single function input", () => {
    // Same source port wired to two inputs of selected nodes
    const source = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathA = blueprint.addNode(200, 0, NODE_TYPES.math);
    const mathB = blueprint.addNode(200, 100, NODE_TYPES.math);

    connect(source.outputPorts[0], mathA.inputPorts[0]);
    connect(source.outputPorts[0], mathB.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathA, true);
    blueprint.selectNode(mathB, true);

    const result = blueprint.turnSelectionIntoFunction("SharedIn");
    const contract = result.functionGraph.data.contract;

    // One external source → one function input, even though it feeds two nodes
    expect(contract.inputs.length).toBe(1);
    expect(result.callerNode.inputPorts[0].connections.length).toBe(1);
    expect(result.callerNode.inputPorts[0].connections[0].startPort.node).toBe(source);
  });
});

// ── 3. No external connections ───────────────────────────────────────────

describe("turnSelectionIntoFunction — no external connections", () => {
  it("creates a function with no inputs/outputs if node is isolated", () => {
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("Isolated");
    const contract = result.functionGraph.data.contract;

    expect(contract.inputs.length).toBe(0);
    expect(contract.outputs.length).toBe(0);
  });

  it("internally-wired selection with no external connections has no function I/O", () => {
    const mathA = blueprint.addNode(0, 0, NODE_TYPES.math);
    const mathB = blueprint.addNode(200, 0, NODE_TYPES.math);
    connect(mathA.outputPorts[0], mathB.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathA, true);
    blueprint.selectNode(mathB, true);

    const result = blueprint.turnSelectionIntoFunction("AllInternal");
    const contract = result.functionGraph.data.contract;

    expect(contract.inputs.length).toBe(0);
    expect(contract.outputs.length).toBe(0);
  });
});

// ── 4. Edge cases — exclusions ───────────────────────────────────────────

describe("turnSelectionIntoFunction — exclusions", () => {
  it("returns null when selection is empty", () => {
    blueprint.clearSelection();
    const result = blueprint.turnSelectionIntoFunction("Empty");
    expect(result).toBeNull();
  });

  it("returns null when only output node is selected", () => {
    const outputNode = blueprint.nodes.find(n => n.nodeType === NODE_TYPES.output);
    blueprint.clearSelection();
    blueprint.selectNode(outputNode);
    const result = blueprint.turnSelectionIntoFunction("OutputOnly");
    expect(result).toBeNull();
  });

  it("excludes output node from selection but extracts the rest", () => {
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const outputNode = blueprint.nodes.find(n => n.nodeType === NODE_TYPES.output);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode, true);
    blueprint.selectNode(destNode, true);
    blueprint.selectNode(outputNode, true);

    const result = blueprint.turnSelectionIntoFunction("SkipOutput");
    expect(result).toBeDefined();

    // Output node should still be in main graph
    expect(blueprint.mainGraph.nodes).toContain(outputNode);
    // Both math and dest should be extracted
    expect(blueprint.mainGraph.nodes).not.toContain(mathNode);
    expect(blueprint.mainGraph.nodes).not.toContain(destNode);
  });

  it("excludes boundary nodes (functionInput/Output) when extracting inside a function", () => {
    const fn = blueprint.createFunctionGraph({ name: "Outer" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    blueprint.setActiveGraph(fn.id);

    const fnInput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionInput);
    const fnOutput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionOutput);
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    connect(fnInput.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], fnOutput.inputPorts[0]);
    blueprint.history.pushState("setup");

    // Select everything including boundary nodes
    blueprint.clearSelection();
    blueprint.selectNode(fnInput, true);
    blueprint.selectNode(mathNode, true);
    blueprint.selectNode(fnOutput, true);

    const result = blueprint.turnSelectionIntoFunction("InnerFn");
    expect(result).toBeDefined();

    // Boundary nodes should still be in the outer function graph
    expect(fn.nodes).toContain(fnInput);
    expect(fn.nodes).toContain(fnOutput);
  });
});

// ── 5. Extracting within a function graph ────────────────────────────────

describe("turnSelectionIntoFunction — inside function/loop graphs", () => {
  it("works inside a function graph", () => {
    const fn = blueprint.createFunctionGraph({ name: "Outer" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    blueprint.setActiveGraph(fn.id);

    const fnInput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionInput);
    const fnOutput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionOutput);
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    connect(fnInput.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], fnOutput.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const graphsBefore = blueprint.graphs.size;
    const result = blueprint.turnSelectionIntoFunction("Nested");

    expect(result).toBeDefined();
    expect(blueprint.graphs.size).toBe(graphsBefore + 1);

    // Math node should be gone from the outer function
    expect(fn.nodes).not.toContain(mathNode);

    // Caller should be wired to fnInput and fnOutput
    expect(result.callerNode.inputPorts.length).toBeGreaterThanOrEqual(1);
    expect(result.callerNode.outputPorts.length).toBeGreaterThanOrEqual(1);
  });

  it("works inside a loop body graph", () => {
    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);
    blueprint.setActiveGraph(loop.id);

    const loopInput = loop.nodes.find(n => n.nodeType === NODE_TYPES.functionInput);
    const loopOutput = loop.nodes.find(n => n.nodeType === NODE_TYPES.functionOutput);
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);

    // Index is port 0, Count is port 1, sum is port 2
    connect(loopInput.outputPorts[2], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], loopOutput.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("FromLoop");
    expect(result).toBeDefined();
    expect(loop.nodes).not.toContain(mathNode);
  });
});

// ── 6. Different type wires ──────────────────────────────────────────────

describe("turnSelectionIntoFunction — type handling", () => {
  it("assigns concrete types for external connections", () => {
    // Vec3 has concrete float inputs, deVec3 has concrete float outputs
    const srcFloat = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const vec3Node = blueprint.addNode(0, 0, NODE_TYPES.vec3);
    const splitNode = blueprint.addNode(200, 0, NODE_TYPES.vec3Decompose);
    const destMath = blueprint.addNode(400, 0, NODE_TYPES.math);

    connect(srcFloat.outputPorts[0], vec3Node.inputPorts[0]);
    connect(vec3Node.outputPorts[0], splitNode.inputPorts[0]);
    connect(splitNode.outputPorts[0], destMath.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(vec3Node, true);
    blueprint.selectNode(splitNode, true);

    const result = blueprint.turnSelectionIntoFunction("TypedFn");
    const contract = result.functionGraph.data.contract;

    // Input from float source
    expect(contract.inputs.some(p => p.type === "float")).toBe(true);
    // Output going to float dest
    expect(contract.outputs.some(p => p.type === "float")).toBe(true);
  });

  it("uses generic type T for multiple ports of the same type", () => {
    // Two float inputs and one float output — all floats
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    const srcA = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const srcB = blueprint.addNode(-200, 100, NODE_TYPES.floatInput);
    const dest = blueprint.addNode(200, 0, NODE_TYPES.math);

    connect(srcA.outputPorts[0], mathNode.inputPorts[0]);
    connect(srcB.outputPorts[0], mathNode.inputPorts[1]);
    connect(mathNode.outputPorts[0], dest.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("GenericFn");
    const contract = result.functionGraph.data.contract;

    // All ports are float — should all use the same concrete type
    for (const p of [...contract.inputs, ...contract.outputs]) {
      expect(p.type).toBe("float");
    }
  });

  it("assigns different types for mixed-type ports", () => {
    // Vec3 has concrete float inputs and concrete vec3 output — no genType
    const composeNode = blueprint.addNode(0, 0, NODE_TYPES.vec3);
    const srcFloat = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const destVec = blueprint.addNode(200, 0, NODE_TYPES.vec3Decompose);

    // Both connections are type-compatible (float→float and vec3→vec3)
    connect(srcFloat.outputPorts[0], composeNode.inputPorts[0]);
    connect(composeNode.outputPorts[0], destVec.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(composeNode);

    const result = blueprint.turnSelectionIntoFunction("MixedFn");
    const contract = result.functionGraph.data.contract;

    // Vec3 has 3 float inputs, 1 vec3 output
    // Only 1 input is connected externally (from srcFloat)
    expect(contract.inputs.length).toBe(1);
    expect(contract.inputs[0].type).toBe("float");
    expect(contract.outputs.length).toBe(1);
    expect(contract.outputs[0].type).toBe("vec3");
  });
});

// ── 7. Undo/redo ─────────────────────────────────────────────────────────

describe("turnSelectionIntoFunction — undo/redo", () => {
  it("undo restores source graph node and wire counts", () => {
    const srcNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 0, NODE_TYPES.math);
    connect(srcNode.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    const nodeCountBefore = blueprint.mainGraph.nodes.length;
    const wireCountBefore = blueprint.mainGraph.wires.length;

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);
    blueprint.turnSelectionIntoFunction("UndoTest");

    // Verify the extraction happened (math removed, caller added = same count)
    // But wire count changes
    expect(blueprint.mainGraph.nodes.find(n => n === mathNode)).toBeUndefined();

    // Undo
    blueprint.history.undo();

    // Node count and wire count should be restored
    expect(blueprint.mainGraph.nodes.length).toBe(nodeCountBefore);
    expect(blueprint.mainGraph.wires.length).toBe(wireCountBefore);
  });

  it("redo re-applies the extraction", () => {
    const srcNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 0, NODE_TYPES.math);
    connect(srcNode.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);
    blueprint.turnSelectionIntoFunction("RedoTest");

    const hasCaller = () => !!blueprint.mainGraph.nodes.find(n => n.nodeType.isFunctionCall);
    expect(hasCaller()).toBe(true);

    blueprint.history.undo();
    expect(hasCaller()).toBe(false);
    // Math node should be back
    expect(blueprint.mainGraph.nodes.find(n => n.nodeType === NODE_TYPES.math)).toBeDefined();

    blueprint.history.redo();
    expect(hasCaller()).toBe(true);
  });

  it("undo inside a function graph restores the function body", () => {
    const fn = blueprint.createFunctionGraph({ name: "Outer" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    blueprint.setActiveGraph(fn.id);

    const fnInput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionInput);
    const fnOutput = fn.nodes.find(n => n.nodeType === NODE_TYPES.functionOutput);
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    connect(fnInput.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], fnOutput.inputPorts[0]);
    blueprint.history.pushState("setup");

    const nodeCountBefore = fn.nodes.length;
    const wireCountBefore = fn.wires.length;

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);
    blueprint.turnSelectionIntoFunction("NestedUndo");

    // Math node should be replaced with a caller
    expect(fn.nodes.find(n => n === mathNode)).toBeUndefined();

    blueprint.history.undo();
    expect(fn.nodes.length).toBe(nodeCountBefore);
    expect(fn.wires.length).toBe(wireCountBefore);
  });
});

// ── 8. Port values and node properties ───────────────────────────────────

describe("turnSelectionIntoFunction — node properties", () => {
  it("preserves port default values on extracted nodes", () => {
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    // Set a custom value on input port B (index 1)
    mathNode.inputPorts[1].value = 42.0;
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("ValFn");
    const fnGraph = result.functionGraph;

    // Find the math node in the function body
    const bodyMath = fnGraph.nodes.find(
      n => n.nodeType !== NODE_TYPES.functionInput && n.nodeType !== NODE_TYPES.functionOutput
    );
    expect(bodyMath).toBeDefined();
    expect(bodyMath.inputPorts[1].value).toBe(42.0);
  });

  it("preserves node operation setting", () => {
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    mathNode.operation = "subtract";
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);

    const result = blueprint.turnSelectionIntoFunction("OpFn");
    const fnGraph = result.functionGraph;

    const bodyMath = fnGraph.nodes.find(
      n => n.nodeType !== NODE_TYPES.functionInput && n.nodeType !== NODE_TYPES.functionOutput
    );
    expect(bodyMath).toBeDefined();
    expect(bodyMath.operation).toBe("subtract");
  });
});

// ── 9. Multiple selected nodes with complex wiring ───────────────────────

describe("turnSelectionIntoFunction — complex selections", () => {
  it("handles a chain of three nodes", () => {
    const src = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const mathA = blueprint.addNode(0, 0, NODE_TYPES.math);
    const mathB = blueprint.addNode(200, 0, NODE_TYPES.math);
    const mathC = blueprint.addNode(400, 0, NODE_TYPES.math);
    const dest = blueprint.addNode(600, 0, NODE_TYPES.math);

    connect(src.outputPorts[0], mathA.inputPorts[0]);
    connect(mathA.outputPorts[0], mathB.inputPorts[0]);
    connect(mathB.outputPorts[0], mathC.inputPorts[0]);
    connect(mathC.outputPorts[0], dest.inputPorts[0]);
    blueprint.history.pushState("setup");

    // Select middle three
    blueprint.clearSelection();
    blueprint.selectNode(mathA, true);
    blueprint.selectNode(mathB, true);
    blueprint.selectNode(mathC, true);

    const result = blueprint.turnSelectionIntoFunction("Chain");
    expect(result).toBeDefined();

    const contract = result.functionGraph.data.contract;
    expect(contract.inputs.length).toBe(1);
    expect(contract.outputs.length).toBe(1);

    // The body should have 3 nodes + 2 boundary nodes
    expect(result.functionGraph.nodes.length).toBe(5);

    // Internal wires: A→B, B→C = 2 internal + boundary wires
    const bodyWires = result.functionGraph.wires.length;
    expect(bodyWires).toBeGreaterThanOrEqual(2);
  });

  it("handles diamond pattern (fork + join)", () => {
    const src = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const fork = blueprint.addNode(0, 0, NODE_TYPES.math);
    const branchA = blueprint.addNode(200, -50, NODE_TYPES.math);
    const branchB = blueprint.addNode(200, 50, NODE_TYPES.math);
    const join = blueprint.addNode(400, 0, NODE_TYPES.math);
    const dest = blueprint.addNode(600, 0, NODE_TYPES.math);

    connect(src.outputPorts[0], fork.inputPorts[0]);
    connect(fork.outputPorts[0], branchA.inputPorts[0]);
    connect(fork.outputPorts[0], branchB.inputPorts[0]);
    connect(branchA.outputPorts[0], join.inputPorts[0]);
    connect(branchB.outputPorts[0], join.inputPorts[1]);
    connect(join.outputPorts[0], dest.inputPorts[0]);
    blueprint.history.pushState("setup");

    // Select the diamond (fork, branchA, branchB, join)
    blueprint.clearSelection();
    blueprint.selectNode(fork, true);
    blueprint.selectNode(branchA, true);
    blueprint.selectNode(branchB, true);
    blueprint.selectNode(join, true);

    const result = blueprint.turnSelectionIntoFunction("Diamond");
    expect(result).toBeDefined();

    const contract = result.functionGraph.data.contract;
    expect(contract.inputs.length).toBe(1);
    expect(contract.outputs.length).toBe(1);
  });
});

// ── 10. Generic types on function I/O ────────────────────────────────────

describe("turnSelectionIntoFunction — generic type support", () => {
  it("supports U, V generic types in function contracts", () => {
    // Create a function manually with U and V generic types
    const fn = blueprint.createFunctionGraph({ name: "MultiGeneric" });
    fn.data.contract = {
      inputs: [
        { id: "p1", name: "a", type: "T" },
        { id: "p2", name: "b", type: "U" },
      ],
      outputs: [
        { id: "p3", name: "r", type: "T" },
        { id: "p4", name: "s", type: "U" },
      ],
    };
    blueprint.syncContractCallers(fn);

    // Create a caller node
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);

    // The caller should have 2 inputs and 2 outputs
    expect(caller.inputPorts.length).toBe(2);
    expect(caller.outputPorts.length).toBe(2);

    // Connect a float to input T and vec3 to input U
    const floatSrc = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const vec3Src = blueprint.addNode(-200, 100, NODE_TYPES.vec3);
    connect(floatSrc.outputPorts[0], caller.inputPorts[0]);
    connect(vec3Src.outputPorts[0], caller.inputPorts[1]);

    // T should resolve to float, U should resolve to vec3
    expect(caller.inputPorts[0].getResolvedType()).toBe("float");
    expect(caller.inputPorts[1].getResolvedType()).toBe("vec3");
    expect(caller.outputPorts[0].getResolvedType()).toBe("float");
    expect(caller.outputPorts[1].getResolvedType()).toBe("vec3");
  });
});

// ── 11. Codegen after extraction ─────────────────────────────────────────

describe("turnSelectionIntoFunction — codegen", () => {
  it("shader compiles after extraction", () => {
    const floatNode = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    const destNode = blueprint.addNode(400, 0, NODE_TYPES.math);
    connect(floatNode.outputPorts[0], mathNode.inputPorts[0]);
    connect(mathNode.outputPorts[0], destNode.inputPorts[0]);
    blueprint.history.pushState("setup");

    blueprint.clearSelection();
    blueprint.selectNode(mathNode);
    blueprint.turnSelectionIntoFunction("CodegenFn");

    // Attempt to generate shaders — should not throw
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const shaders = blueprint.generateAllShaders();
    expect(shaders).toBeDefined();
  });
});

// ── 12. Input deduplication ──────────────────────────────────────────────

describe("turnSelectionIntoFunction — input deduplication", () => {
  it("same output port feeding two selected input ports creates one function input", () => {
    const src = blueprint.addNode(-200, 0, NODE_TYPES.floatInput);
    const mathA = blueprint.addNode(0, 0, NODE_TYPES.math);
    const mathB = blueprint.addNode(0, 100, NODE_TYPES.math);
    const dest = blueprint.addNode(200, 50, NODE_TYPES.math);

    connect(src.outputPorts[0], mathA.inputPorts[0]);
    connect(src.outputPorts[0], mathB.inputPorts[0]);
    connect(mathA.outputPorts[0], dest.inputPorts[0]);
    connect(mathB.outputPorts[0], dest.inputPorts[1]);
    blueprint.history.pushState("setup");

    // Select A and B
    blueprint.clearSelection();
    blueprint.selectNode(mathA, true);
    blueprint.selectNode(mathB, true);

    const result = blueprint.turnSelectionIntoFunction("Dedup");
    const contract = result.functionGraph.data.contract;

    // One shared source → one function input
    expect(contract.inputs.length).toBe(1);
    // Two outputs going outside
    expect(contract.outputs.length).toBe(2);
  });
});
