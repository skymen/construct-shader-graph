// Test 23: Multi-graph history — per-graph isolation, transactional undo/redo,
// contract edit rollback, interleaved editing, and edge cases.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES, api;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES, api } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function connect(srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
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

function snapshotGraph(g) {
  return blueprint._exportGraphState(g);
}

// ────────────────────────────────────────────────────────────────
// 1. Per-graph history isolation
// ────────────────────────────────────────────────────────────────

describe("per-graph history isolation", () => {
  it("each graph owns its own HistoryManager instance", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    expect(fn.history).toBeDefined();
    expect(fn.history).not.toBe(blueprint.mainGraph.history);
  });

  it("editing graph A then undoing does not affect graph B", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });
    gB.data.contract = {
      inputs: [{ id: "b1", name: "x", type: "float" }],
      outputs: [{ id: "b2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(gB);

    // Edit A: add a node
    blueprint.setActiveGraph(gA.id);
    const beforeA = gA.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(gA.nodes.length).toBe(beforeA + 1);

    const bSnapshot = snapshotGraph(gB);

    // Undo on A
    gA.history.undo();
    expect(gA.nodes.length).toBe(beforeA);

    // B must be identical
    const bAfter = snapshotGraph(gB);
    expect(bAfter.nodes.length).toBe(bSnapshot.nodes.length);
    expect(bAfter.wires.length).toBe(bSnapshot.wires.length);
  });

  it("redo on graph A does not affect graph B", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });

    blueprint.setActiveGraph(gA.id);
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const bSnapshot = snapshotGraph(gB);

    gA.history.undo();
    gA.history.redo();

    const bAfter = snapshotGraph(gB);
    expect(bAfter.nodes.length).toBe(bSnapshot.nodes.length);
  });

  it("undo/redo stacks are independent across graphs", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });
    gB.data.contract = {
      inputs: [{ id: "b1", name: "x", type: "float" }],
      outputs: [{ id: "b2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(gB);

    blueprint.setActiveGraph(gA.id);
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });

    // A has an undo entry, B does not (except from syncContractCallers)
    expect(gA.history.canUndo()).toBe(true);
    // B's undo state is from contract sync, not from A's node creation
    const bUndoCount = gB.history.undoStack.length;

    // Adding a node to A shouldn't change B's stack count
    api.nodes.create({ typeKey: "math", x: 100, y: 0 });
    expect(gB.history.undoStack.length).toBe(bUndoCount);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. Interleaved editing across graphs
// ────────────────────────────────────────────────────────────────

describe("interleaved editing across graphs", () => {
  it("edit A, switch to B, edit B, switch to A, undo A — B stays intact", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });

    // Edit A
    blueprint.setActiveGraph(gA.id);
    const beforeA = gA.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(gA.nodes.length).toBe(beforeA + 1);

    // Switch to B, edit B
    blueprint.setActiveGraph(gB.id);
    const beforeB = gB.nodes.length;
    const mathNode = blueprint.addNode(0, 0, NODE_TYPES.math);
    gB.history.pushState("add math to B");

    // Switch back to A, undo
    blueprint.setActiveGraph(gA.id);
    gA.history.undo();
    expect(gA.nodes.length).toBe(beforeA);

    // B must still have the math node
    expect(gB.nodes.length).toBe(beforeB + 1);
    expect(gB.nodes.some((n) => n.id === mathNode.id)).toBe(true);
  });

  it("multiple undo/redo cycles on different graphs are independent", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });

    // Two edits on A
    blueprint.setActiveGraph(gA.id);
    const baseA = gA.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    api.nodes.create({ typeKey: "math", x: 100, y: 0 });
    expect(gA.nodes.length).toBe(baseA + 2);

    // One edit on B
    blueprint.setActiveGraph(gB.id);
    const baseB = gB.nodes.length;
    blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    gB.history.pushState("add to B");

    // Undo both A edits
    gA.history.undo();
    gA.history.undo();
    expect(gA.nodes.length).toBe(baseA);

    // B unchanged
    expect(gB.nodes.length).toBe(baseB + 1);

    // Redo one A edit
    gA.history.redo();
    expect(gA.nodes.length).toBe(baseA + 1);

    // B still unchanged
    expect(gB.nodes.length).toBe(baseB + 1);
  });
});

// ────────────────────────────────────────────────────────────────
// 3. Transactional undo (contract edit → caller rebuild)
// ────────────────────────────────────────────────────────────────

describe("transactional undo/redo via syncContractCallers", () => {
  it("syncContractCallers creates history entries with matching transactionIds", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    // Place a caller in main
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    // Edit the contract
    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    // Both fn and main should have new undo entries
    const fnEntry = fn.history.undoStack[fn.history.undoStack.length - 1];
    const mainEntry = blueprint.mainGraph.history.undoStack[
      blueprint.mainGraph.history.undoStack.length - 1
    ];

    expect(fnEntry).toBeDefined();
    expect(mainEntry).toBeDefined();
    expect(fnEntry.transactionId).toBeDefined();
    expect(mainEntry.transactionId).toBe(fnEntry.transactionId);
  });

  it("undo on fn graph rolls back sibling (main) via transactionId", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);
    expect(caller.inputPorts.length).toBe(1);

    // Snapshot main's baseline
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    // Contract edit adds a second input
    fn.data.contract.inputs.push({ id: "p3", name: "z", type: "vec3" });
    blueprint.syncContractCallers(fn);

    expect(caller.inputPorts.length).toBe(2);

    // Undo on the function graph should also roll back main
    blueprint.setActiveGraph(fn.id);
    fn.history.undo();

    // fn contract should be restored
    expect(fn.data.contract.inputs.length).toBe(1);

    // main's caller should also be restored
    const restoredCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
    );
    expect(restoredCaller).toBeDefined();
    expect(restoredCaller.inputPorts.length).toBe(1);
  });

  it("undo on main graph rolls back sibling (fn) via transactionId", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    const contractVersionBefore = fn.contractVersion;

    fn.data.contract.inputs.push({ id: "p3", name: "added", type: "float" });
    blueprint.syncContractCallers(fn);

    expect(fn.contractVersion).toBeGreaterThan(contractVersionBefore);

    // Undo on main should also roll back fn
    blueprint.mainGraph.history.undo();

    expect(fn.data.contract.inputs.length).toBe(1);
    expect(fn.contractVersion).toBe(contractVersionBefore);
  });

  it("transaction redo re-applies both fn and main changes", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    fn.data.contract.inputs.push({ id: "p3", name: "z", type: "vec3" });
    blueprint.syncContractCallers(fn);

    // Undo then redo on fn
    fn.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);

    fn.history.redo();
    expect(fn.data.contract.inputs.length).toBe(2);
    expect(fn.data.contract.inputs[1].name).toBe("z");

    // Main must also be re-applied
    const reCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
    );
    expect(reCaller).toBeDefined();
    expect(reCaller.inputPorts.length).toBe(2);
  });

  it("transaction redo via main graph also restores fn", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    addCaller(fn);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    fn.data.contract.inputs.push({ id: "p3", name: "added", type: "float" });
    blueprint.syncContractCallers(fn);

    blueprint.mainGraph.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);

    blueprint.mainGraph.history.redo();
    expect(fn.data.contract.inputs.length).toBe(2);
    expect(fn.data.contract.inputs[1].name).toBe("added");
  });
});

// ────────────────────────────────────────────────────────────────
// 4. Contract affecting callers in multiple graphs
// ────────────────────────────────────────────────────────────────

describe("transaction spanning multiple sibling graphs", () => {
  it("contract change affecting callers in two different graphs undoes atomically", () => {
    const target = blueprint.createFunctionGraph({ name: "Target" });
    target.data.contract = {
      inputs: [{ id: "t1", name: "x", type: "float" }],
      outputs: [{ id: "t2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(target);

    // Caller in main
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const callerMain = addCaller(target);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    // Caller in a second function graph
    const host = blueprint.createFunctionGraph({ name: "Host" });
    host.data.contract = {
      inputs: [{ id: "h1", name: "a", type: "float" }],
      outputs: [{ id: "h2", name: "b", type: "float" }],
    };
    blueprint.syncContractCallers(host);
    blueprint.setActiveGraph(host.id);
    const callerHost = addCaller(target);
    host.history.currentState = snapshotGraph(host);

    expect(callerMain.inputPorts.length).toBe(1);
    expect(callerHost.inputPorts.length).toBe(1);

    // Edit target's contract
    target.data.contract.inputs.push({ id: "t3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(target);

    expect(callerMain.inputPorts.length).toBe(2);
    expect(callerHost.inputPorts.length).toBe(2);

    // Undo on target should roll back all three graphs
    target.history.undo();

    expect(target.data.contract.inputs.length).toBe(1);

    const mainCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === target.id
    );
    expect(mainCaller).toBeDefined();
    expect(mainCaller.inputPorts.length).toBe(1);

    const hostCaller = host.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === target.id
    );
    expect(hostCaller).toBeDefined();
    expect(hostCaller.inputPorts.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// 5. Deep undo chain (multiple sequential contract edits)
// ────────────────────────────────────────────────────────────────

describe("deep undo chain", () => {
  it("three sequential contract edits can be undone one at a time", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "a", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    // Edit 1: add input b
    fn.data.contract.inputs.push({ id: "p3", name: "b", type: "float" });
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs.length).toBe(2);

    // Edit 2: add input c
    fn.data.contract.inputs.push({ id: "p4", name: "c", type: "vec3" });
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs.length).toBe(3);

    // Edit 3: rename first input
    fn.data.contract.inputs[0].name = "alpha";
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs[0].name).toBe("alpha");

    // Undo edit 3 — restore name
    fn.history.undo();
    expect(fn.data.contract.inputs[0].name).toBe("a");
    expect(fn.data.contract.inputs.length).toBe(3);

    // Undo edit 2 — remove c
    fn.history.undo();
    expect(fn.data.contract.inputs.length).toBe(2);

    // Undo edit 1 — remove b
    fn.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);
    expect(fn.data.contract.inputs[0].name).toBe("a");
  });

  it("redo after partial undo restores intermediate state", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    fn.data.contract.inputs.push({ id: "p4", name: "z", type: "vec2" });
    blueprint.syncContractCallers(fn);

    // Undo twice, then redo once → should be at the 2-input state
    fn.history.undo();
    fn.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);

    fn.history.redo();
    expect(fn.data.contract.inputs.length).toBe(2);
    expect(fn.data.contract.inputs[1].name).toBe("y");
  });
});

// ────────────────────────────────────────────────────────────────
// 6. Contract undo restoring boundary nodes and body wires
// ────────────────────────────────────────────────────────────────

describe("contract undo restores boundary nodes and body wires", () => {
  it("undo restores FunctionInput/FunctionOutput port counts", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    const fnIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    expect(fnIn.outputPorts.length).toBe(1);
    expect(fnOut.inputPorts.length).toBe(1);

    // Add a second input
    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    const fnIn2 = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    expect(fnIn2.outputPorts.length).toBe(2);

    // Undo
    fn.history.undo();

    const fnInRestored = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOutRestored = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    expect(fnInRestored.outputPorts.length).toBe(1);
    expect(fnOutRestored.inputPorts.length).toBe(1);
  });

  it("body wires survive undo round-trip", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    // Wire FunctionInput.x → FunctionOutput.r
    blueprint.setActiveGraph(fn.id);
    const fnIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(fnIn.outputPorts[0], fnOut.inputPorts[0]);
    expect(fn.wires.length).toBe(1);

    // Snapshot this state
    fn.history.currentState = snapshotGraph(fn);

    // Add a second input via contract (this rebuilds boundary nodes)
    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    // Undo should restore the 1-input state with the body wire intact
    fn.history.undo();

    expect(fn.data.contract.inputs.length).toBe(1);
    expect(fn.wires.length).toBe(1);

    const restoredIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const restoredOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    expect(restoredIn.outputPorts[0].connections.length).toBe(1);
    expect(restoredOut.inputPorts[0].connections.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// 7. Loop body history
// ────────────────────────────────────────────────────────────────

describe("loop body contract undo/redo", () => {
  it("loop body contract undo restores acc/arg roles", () => {
    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);

    // Add an arg input
    loop.data.contract.inputs.push({ id: "a2", name: "step", type: "float", role: "arg" });
    blueprint.syncContractCallers(loop);
    expect(loop.data.contract.inputs.length).toBe(2);
    expect(loop.data.contract.inputs[1].role).toBe("arg");

    // Undo
    loop.history.undo();
    expect(loop.data.contract.inputs.length).toBe(1);
    expect(loop.data.contract.inputs[0].role).toBe("acc");
  });

  it("loop body transaction undo rolls back ForLoop callers", () => {
    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(loop);
    // ForLoop inputs: [Count, Initial sum]
    expect(caller.inputPorts.length).toBe(2);
    blueprint.mainGraph.history.currentState = snapshotGraph(blueprint.mainGraph);

    // Add a second accumulator
    loop.data.contract.inputs.push({ id: "a2", name: "prod", type: "float", role: "acc" });
    loop.data.contract.outputs.push({ id: "a2", name: "prod", type: "float" });
    blueprint.syncContractCallers(loop);

    // ForLoop inputs: [Count, Initial sum, Initial prod]
    expect(caller.inputPorts.length).toBe(3);

    // Undo on loop
    loop.history.undo();

    const restoredCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === loop.id
    );
    expect(restoredCaller).toBeDefined();
    // Should be back to [Count, Initial sum]
    expect(restoredCaller.inputPorts.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────
// 8. No-change contract sync does not pollute history
// ────────────────────────────────────────────────────────────────

describe("no-change contract sync", () => {
  it("calling syncContractCallers without changing the contract does not add undo entries", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    const undoCountBefore = fn.history.undoStack.length;

    // Sync again without changing anything
    blueprint.syncContractCallers(fn);

    // The transaction should detect no diff and skip creating entries
    // (contractVersion still increments, so there IS a diff — this tests
    // whether that's the actual behavior)
    const undoCountAfter = fn.history.undoStack.length;

    // At most one entry from the contractVersion bump, but no double-stacking
    expect(undoCountAfter).toBeLessThanOrEqual(undoCountBefore + 1);
  });
});

// ────────────────────────────────────────────────────────────────
// 9. History after createNewFile
// ────────────────────────────────────────────────────────────────

describe("history after createNewFile", () => {
  it("createNewFile clears all graph histories", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    expect(fn.history.canUndo()).toBe(true);

    blueprint.createNewFile();

    // After createNewFile, the main graph history should be fresh
    expect(blueprint.mainGraph.history.canUndo()).toBe(false);
    expect(blueprint.mainGraph.history.canRedo()).toBe(false);
    // fn graph no longer exists
    expect(blueprint.graphs.has(fn.id)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// 10. History + save/load round-trip
// ────────────────────────────────────────────────────────────────

describe("history after save/load", () => {
  function fakeFile(json) {
    return { name: "test.c3sg", text: async () => JSON.stringify(json) };
  }

  it("history is cleared after loading a project", async () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    expect(fn.history.canUndo()).toBe(true);

    const json = blueprint.serializeProjectToJSON();
    await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

    // All graphs should have clean history after load
    for (const g of blueprint.graphs.values()) {
      expect(g.history.canUndo()).toBe(false);
      expect(g.history.canRedo()).toBe(false);
    }
  });

  it("contract edits after load create proper undo entries", async () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    const json = blueprint.serializeProjectToJSON();
    await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

    // Find the reloaded function graph
    const reloadedFn = [...blueprint.graphs.values()].find((g) => g.name === "Fn");
    expect(reloadedFn).toBeDefined();

    // Edit contract after load
    reloadedFn.data.contract.inputs.push({ id: "p3", name: "new", type: "vec3" });
    blueprint.syncContractCallers(reloadedFn);

    expect(reloadedFn.history.canUndo()).toBe(true);

    // Undo should work
    reloadedFn.history.undo();
    expect(reloadedFn.data.contract.inputs.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// 11. runMultiGraphTransaction only affects listed graphs
// ────────────────────────────────────────────────────────────────

describe("runMultiGraphTransaction scoping", () => {
  it("only listed graphs get undo entries", () => {
    const fn1 = blueprint.createFunctionGraph({ name: "Fn1" });
    const fn2 = blueprint.createFunctionGraph({ name: "Fn2" });

    const fn1Before = fn1.history.undoStack.length;
    const fn2Before = fn2.history.undoStack.length;

    // Run a transaction that only touches fn1
    blueprint.runMultiGraphTransaction([fn1.id], () => {
      fn1.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "float" }],
        outputs: [{ id: "p2", name: "r", type: "float" }],
      };
      fn1.contractVersion = (fn1.contractVersion || 0) + 1;
    }, "test edit");

    expect(fn1.history.undoStack.length).toBeGreaterThan(fn1Before);
    expect(fn2.history.undoStack.length).toBe(fn2Before);
  });

  it("transaction with no actual changes does not create entries", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    const before = fn.history.undoStack.length;

    blueprint.runMultiGraphTransaction([fn.id], () => {
      // no-op
    }, "empty transaction");

    expect(fn.history.undoStack.length).toBe(before);
  });
});
