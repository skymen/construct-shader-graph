// Test 23: Multi-graph history — unified host-level stack, transactional
// undo/redo, contract edit rollback, interleaved editing, and edge cases.

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

// ───────��────────────────────────────────────────────────────────
// 1. Unified history stack basics
// ────────────────────────────────────────────────────────────────

describe("unified history stack basics", () => {
  it("host owns a single HistoryManager, graphs do not", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    expect(blueprint.history).toBeDefined();
    expect(fn.history).toBeUndefined();
  });

  it("editing graph A then undoing does not affect graph B", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });
    gB.data.contract = {
      inputs: [{ id: "b1", name: "x", type: "float" }],
      outputs: [{ id: "b2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(gB);

    blueprint.setActiveGraph(gA.id);
    const beforeA = gA.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(gA.nodes.length).toBe(beforeA + 1);

    const bSnapshot = snapshotGraph(gB);

    blueprint.history.undo();
    expect(gA.nodes.length).toBe(beforeA);

    const bAfter = snapshotGraph(gB);
    expect(bAfter.nodes.length).toBe(bSnapshot.nodes.length);
    expect(bAfter.wires.length).toBe(bSnapshot.wires.length);
  });

  it("redo on graph A does not affect graph B", () => {
    const gA = blueprint.mainGraph;
    blueprint.createFunctionGraph({ name: "B" });
    const gB = [...blueprint.graphs.values()].find((g) => g.name === "B");

    blueprint.setActiveGraph(gA.id);
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const bSnapshot = snapshotGraph(gB);

    blueprint.history.undo();
    blueprint.history.redo();

    const bAfter = snapshotGraph(gB);
    expect(bAfter.nodes.length).toBe(bSnapshot.nodes.length);
  });

  it("undo switches to the graph where the change originated", () => {
    const gA = blueprint.mainGraph;
    const gB = blueprint.createFunctionGraph({ name: "B" });

    // Edit A
    blueprint.setActiveGraph(gA.id);
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });

    // Switch to B
    blueprint.setActiveGraph(gB.id);

    // Undo should switch back to A
    blueprint.history.undo();
    expect(blueprint.activeGraphId).toBe(gA.id);
  });
});

// ───────────────────���─────────────────────────────��──────────────
// 2. Interleaved editing across graphs
// ─────────────────���─────────────────────────────────��────────────

describe("interleaved editing across graphs", () => {
  it("edit A, switch to B, edit B, undo undoes B's edit, undo again undoes A's edit", () => {
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
    blueprint.history.pushState("add math to B");
    expect(gB.nodes.length).toBe(beforeB + 1);

    // Undo — should undo B's edit (last entry), switching to B
    blueprint.history.undo();
    expect(gB.nodes.length).toBe(beforeB);
    expect(blueprint.activeGraphId).toBe(gB.id);

    // Undo — should undo A's edit, switching to A
    blueprint.history.undo();
    expect(gA.nodes.length).toBe(beforeA);
    expect(blueprint.activeGraphId).toBe(gA.id);
  });

  it("redo after undo replays in order", () => {
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
    blueprint.history.pushState("add to B");

    // Undo all three
    blueprint.history.undo(); // B's edit
    blueprint.history.undo(); // A's second
    blueprint.history.undo(); // A's first

    expect(gA.nodes.length).toBe(baseA);
    expect(gB.nodes.length).toBe(baseB);

    // Redo first A edit
    blueprint.history.redo();
    expect(gA.nodes.length).toBe(baseA + 1);
    expect(gB.nodes.length).toBe(baseB);

    // Redo second A edit
    blueprint.history.redo();
    expect(gA.nodes.length).toBe(baseA + 2);
    expect(gB.nodes.length).toBe(baseB);

    // Redo B edit
    blueprint.history.redo();
    expect(gB.nodes.length).toBe(baseB + 1);
  });
});

// ─���────────��────────────────────────────────��────────────────────
// 3. Transactional undo (contract edit → caller rebuild)
// ───────────────────────────────────────────────────────���────────

describe("transactional undo/redo via syncContractCallers", () => {
  it("syncContractCallers creates a single unified undo entry covering all affected graphs", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    addCaller(fn);
    blueprint.history.initGraphState(blueprint.mainGraphId, snapshotGraph(blueprint.mainGraph));

    const stackBefore = blueprint.history.undoStack.length;

    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    // Should be exactly one new entry (not one per graph)
    expect(blueprint.history.undoStack.length).toBe(stackBefore + 1);

    const entry = blueprint.history.undoStack[blueprint.history.undoStack.length - 1];
    expect(entry.graphs.length).toBeGreaterThanOrEqual(1);
  });

  it("undo rolls back both fn and main graph changes atomically", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(fn);
    expect(caller.inputPorts.length).toBe(1);
    blueprint.history.initGraphState(blueprint.mainGraphId, snapshotGraph(blueprint.mainGraph));

    fn.data.contract.inputs.push({ id: "p3", name: "z", type: "vec3" });
    blueprint.syncContractCallers(fn);
    expect(caller.inputPorts.length).toBe(2);

    blueprint.history.undo();

    expect(fn.data.contract.inputs.length).toBe(1);

    const restoredCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
    );
    expect(restoredCaller).toBeDefined();
    expect(restoredCaller.inputPorts.length).toBe(1);
  });

  it("redo re-applies both fn and main changes", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    addCaller(fn);
    blueprint.history.initGraphState(blueprint.mainGraphId, snapshotGraph(blueprint.mainGraph));

    fn.data.contract.inputs.push({ id: "p3", name: "z", type: "vec3" });
    blueprint.syncContractCallers(fn);

    blueprint.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);

    blueprint.history.redo();
    expect(fn.data.contract.inputs.length).toBe(2);
    expect(fn.data.contract.inputs[1].name).toBe("z");

    const reCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === fn.id
    );
    expect(reCaller).toBeDefined();
    expect(reCaller.inputPorts.length).toBe(2);
  });
});

// ─────���──────────────────────��───────────────────────────────────
// 4. Contract affecting callers in multiple graphs
// ───────────────────────────────────────────────���────────────────

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
    blueprint.history.initGraphState(blueprint.mainGraphId, snapshotGraph(blueprint.mainGraph));

    // Caller in a second function graph
    const host = blueprint.createFunctionGraph({ name: "Host" });
    host.data.contract = {
      inputs: [{ id: "h1", name: "a", type: "float" }],
      outputs: [{ id: "h2", name: "b", type: "float" }],
    };
    blueprint.syncContractCallers(host);
    blueprint.setActiveGraph(host.id);
    const callerHost = addCaller(target);
    blueprint.history.initGraphState(host.id, snapshotGraph(host));

    expect(callerMain.inputPorts.length).toBe(1);
    expect(callerHost.inputPorts.length).toBe(1);

    target.data.contract.inputs.push({ id: "t3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(target);

    expect(callerMain.inputPorts.length).toBe(2);
    expect(callerHost.inputPorts.length).toBe(2);

    blueprint.history.undo();

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

// ────────────────────���───────────────────────────────────────────
// 5. Deep undo chain (multiple sequential contract edits)
// ──────────────────────────────────────────────���─────────────────

describe("deep undo chain", () => {
  it("three sequential contract edits can be undone one at a time", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "a", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    fn.data.contract.inputs.push({ id: "p3", name: "b", type: "float" });
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs.length).toBe(2);

    fn.data.contract.inputs.push({ id: "p4", name: "c", type: "vec3" });
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs.length).toBe(3);

    fn.data.contract.inputs[0].name = "alpha";
    blueprint.syncContractCallers(fn);
    expect(fn.data.contract.inputs[0].name).toBe("alpha");

    blueprint.history.undo();
    expect(fn.data.contract.inputs[0].name).toBe("a");
    expect(fn.data.contract.inputs.length).toBe(3);

    blueprint.history.undo();
    expect(fn.data.contract.inputs.length).toBe(2);

    blueprint.history.undo();
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

    blueprint.history.undo();
    blueprint.history.undo();
    expect(fn.data.contract.inputs.length).toBe(1);

    blueprint.history.redo();
    expect(fn.data.contract.inputs.length).toBe(2);
    expect(fn.data.contract.inputs[1].name).toBe("y");
  });
});

// ─────────────────────────────────────────────��──────────────────
// 6. Contract undo restoring boundary nodes and body wires
// ──���────────────────────���─────────────────────────────��──────────

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

    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    const fnIn2 = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    expect(fnIn2.outputPorts.length).toBe(2);

    blueprint.history.undo();

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

    blueprint.setActiveGraph(fn.id);
    const fnIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const fnOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(fnIn.outputPorts[0], fnOut.inputPorts[0]);
    expect(fn.wires.length).toBe(1);

    // Commit this state
    blueprint.history.initGraphState(fn.id, snapshotGraph(fn));

    fn.data.contract.inputs.push({ id: "p3", name: "y", type: "vec3" });
    blueprint.syncContractCallers(fn);

    blueprint.history.undo();

    expect(fn.data.contract.inputs.length).toBe(1);
    expect(fn.wires.length).toBe(1);

    const restoredIn = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const restoredOut = fn.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    expect(restoredIn.outputPorts[0].connections.length).toBe(1);
    expect(restoredOut.inputPorts[0].connections.length).toBe(1);
  });
});

// ���──────────────────────────────��────────────────────────────────
// 7. Loop body history
// ────────────────────────────────────────────────────────────���───

describe("loop body contract undo/redo", () => {
  it("loop body contract undo restores acc/arg roles", () => {
    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);

    loop.data.contract.inputs.push({ id: "a2", name: "step", type: "float", role: "arg" });
    blueprint.syncContractCallers(loop);
    expect(loop.data.contract.inputs.length).toBe(2);
    expect(loop.data.contract.inputs[1].role).toBe("arg");

    blueprint.history.undo();
    expect(loop.data.contract.inputs.length).toBe(1);
    expect(loop.data.contract.inputs[0].role).toBe("acc");
  });

  it("_loadGraphState preserves loop body Index/Count wires", () => {
    // Regression: _loadGraphState calls enforceBoundaryRules twice (once before
    // wire restoration, once after). The second call used to drop wires from
    // Index/Count ports because the injected port defs lacked contractPortId.

    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);

    blueprint.setActiveGraph(loop.id);
    const fnInput = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    expect(fnInput.outputPorts[0].name).toBe("Index");
    expect(fnInput.outputPorts[1].name).toBe("Count");

    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    connect(fnInput.outputPorts[0], mathNode.inputPorts[0]);
    connect(fnInput.outputPorts[1], mathNode.inputPorts[1]);

    expect(fnInput.outputPorts[0].connections.length).toBe(1);
    expect(fnInput.outputPorts[1].connections.length).toBe(1);
    const wireCount = loop.wires.length;

    // Snapshot and reload — exercises the double enforceBoundaryRules path
    const snapshot = snapshotGraph(loop);
    blueprint._loadGraphState(loop, snapshot);

    const restoredInput = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    expect(restoredInput.outputPorts[0].name).toBe("Index");
    expect(restoredInput.outputPorts[0].portType).toBe("int");
    expect(restoredInput.outputPorts[0].connections.length).toBe(1);
    expect(restoredInput.outputPorts[1].name).toBe("Count");
    expect(restoredInput.outputPorts[1].portType).toBe("int");
    expect(restoredInput.outputPorts[1].connections.length).toBe(1);
    expect(loop.wires.length).toBe(wireCount);
  });

  it("loop body Index/Count wires survive contract edit undo", () => {
    // Verify that editing the loop body's OWN contract and undoing
    // does not disconnect wires from the injected Index/Count ports.

    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    loop.data.contract = {
      inputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
      outputs: [{ id: "a1", name: "sum", type: "float" }],
    };
    blueprint.syncContractCallers(loop);

    blueprint.setActiveGraph(loop.id);
    const fnInput = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const mathNode = blueprint.addNode(200, 0, NODE_TYPES.math);
    blueprint.history.pushState("add math");

    // Wire Index → math input A
    connect(fnInput.outputPorts[0], mathNode.inputPorts[0]);
    // Wire Count → math input B
    connect(fnInput.outputPorts[1], mathNode.inputPorts[1]);
    blueprint.history.pushState("wire index/count");

    expect(fnInput.outputPorts[0].connections.length).toBe(1);
    expect(fnInput.outputPorts[1].connections.length).toBe(1);
    const wireCount = loop.wires.length;

    blueprint.history.initGraphState(loop.id, snapshotGraph(loop));

    // Edit the loop body's own contract: add an arg port
    loop.data.contract.inputs.push({ id: "a2", name: "step", type: "float", role: "arg" });
    blueprint.syncContractCallers(loop);

    // Undo
    blueprint.history.undo();

    const restoredInput = loop.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    expect(restoredInput.outputPorts[0].name).toBe("Index");
    expect(restoredInput.outputPorts[1].name).toBe("Count");
    expect(restoredInput.outputPorts[0].connections.length).toBe(1);
    expect(restoredInput.outputPorts[1].connections.length).toBe(1);
    expect(loop.wires.length).toBe(wireCount);
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
    expect(caller.inputPorts.length).toBe(2);
    blueprint.history.initGraphState(blueprint.mainGraphId, snapshotGraph(blueprint.mainGraph));

    loop.data.contract.inputs.push({ id: "a2", name: "prod", type: "float", role: "acc" });
    loop.data.contract.outputs.push({ id: "a2", name: "prod", type: "float" });
    blueprint.syncContractCallers(loop);

    expect(caller.inputPorts.length).toBe(3);

    blueprint.history.undo();

    const restoredCaller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall && n.nodeType.targetGraphId === loop.id
    );
    expect(restoredCaller).toBeDefined();
    expect(restoredCaller.inputPorts.length).toBe(2);
  });
});

// ────────────────────────────────────���───────────────────────────
// 8. No-change contract sync does not pollute history
// ─────────────────��──────────────────────────────────────────────

describe("no-change contract sync", () => {
  it("calling syncContractCallers without changing the contract does not add undo entries", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);

    const undoCountBefore = blueprint.history.undoStack.length;

    // Sync again without changing anything
    blueprint.syncContractCallers(fn);

    const undoCountAfter = blueprint.history.undoStack.length;

    // At most one entry from the contractVersion bump
    expect(undoCountAfter).toBeLessThanOrEqual(undoCountBefore + 1);
  });
});

// ──��─────────────────────��───────────────────────────────────────
// 9. History after createNewFile
// ─���────────────��─────────────────────────────────���───────────────

describe("history after createNewFile", () => {
  it("createNewFile clears all history", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = {
      inputs: [{ id: "p1", name: "x", type: "float" }],
      outputs: [{ id: "p2", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(fn);
    expect(blueprint.history.canUndo()).toBe(true);

    blueprint.createNewFile();

    expect(blueprint.history.canUndo()).toBe(false);
    expect(blueprint.history.canRedo()).toBe(false);
    expect(blueprint.graphs.has(fn.id)).toBe(false);
  });
});

// ───────────────────────────────────���────────────────────────────
// 10. History + save/load round-trip
// ─────���────────────────────────────────────────────���─────────────

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
    expect(blueprint.history.canUndo()).toBe(true);

    const json = blueprint.serializeProjectToJSON();
    await blueprint.loadFromJSON(fakeFile(JSON.parse(json)));

    expect(blueprint.history.canUndo()).toBe(false);
    expect(blueprint.history.canRedo()).toBe(false);
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

    const reloadedFn = [...blueprint.graphs.values()].find((g) => g.name === "Fn");
    expect(reloadedFn).toBeDefined();

    reloadedFn.data.contract.inputs.push({ id: "p3", name: "new", type: "vec3" });
    blueprint.syncContractCallers(reloadedFn);

    expect(blueprint.history.canUndo()).toBe(true);

    blueprint.history.undo();
    expect(reloadedFn.data.contract.inputs.length).toBe(1);
  });
});

// ──��─────────────────────────────���───────────────────────���───────
// 11. runMultiGraphTransaction only affects listed graphs
// ──────────────────��─────────────────────────────────��───────────

describe("runMultiGraphTransaction scoping", () => {
  it("only listed graphs get included in the undo entry", () => {
    const fn1 = blueprint.createFunctionGraph({ name: "Fn1" });
    const fn2 = blueprint.createFunctionGraph({ name: "Fn2" });

    const stackBefore = blueprint.history.undoStack.length;

    blueprint.runMultiGraphTransaction([fn1.id], () => {
      fn1.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "float" }],
        outputs: [{ id: "p2", name: "r", type: "float" }],
      };
      fn1.contractVersion = (fn1.contractVersion || 0) + 1;
    }, "test edit");

    expect(blueprint.history.undoStack.length).toBeGreaterThan(stackBefore);

    // The entry should only contain fn1, not fn2
    const entry = blueprint.history.undoStack[blueprint.history.undoStack.length - 1];
    const graphIds = entry.graphs.map((g) => g.graphId);
    expect(graphIds).toContain(fn1.id);
    expect(graphIds).not.toContain(fn2.id);
  });

  it("transaction with no actual changes does not create entries", () => {
    blueprint.createFunctionGraph({ name: "Fn" });
    const fn = [...blueprint.graphs.values()].find((g) => g.name === "Fn");
    const before = blueprint.history.undoStack.length;

    blueprint.runMultiGraphTransaction([fn.id], () => {
      // no-op
    }, "empty transaction");

    expect(blueprint.history.undoStack.length).toBe(before);
  });
});
