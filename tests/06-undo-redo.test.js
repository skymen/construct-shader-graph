// Real undo/redo round-trip through the BlueprintSystem.
// The unified host-level HistoryManager stores all graphs in one stack.
//
// The second half of this file guards the failure mode that made undo feel
// haunted: `pushState` diffs against the *last pushed* snapshot, so a mutation
// that pushes nothing (or that the differ cannot see) leaves the baseline stale
// and gets folded into whatever is recorded next. Undoing an unrelated edit
// then reverts it too. Every "leaks into the next undo entry" test below is
// that invariant for one action.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
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

// Coalescing merges two pushes made within a second of each other when their
// changed-property sets overlap, which is right for the editor and wrong for a
// test counting entries. Pretend the previous push was long ago.
function defeatCoalescing() {
  blueprint.history.lastChangeTime = 0;
}

// An edit unrelated to whatever the test just did, so the next undo targets it
// and not the action under test.
function unrelatedEdit() {
  defeatCoalescing();
  return api.nodes.create({ typeKey: "floatInput", x: 900, y: 900 });
}

describe("Undo / Redo", () => {
  it("creating a node via API pushes one undo entry", () => {
    const before = blueprint.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(blueprint.nodes.length).toBe(before + 1);
    expect(blueprint.history.canUndo()).toBe(true);
  });

  it("undo removes the created node; redo brings it back", () => {
    const before = blueprint.nodes.length;
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    expect(blueprint.nodes.length).toBe(before + 1);

    blueprint.history.undo();
    expect(blueprint.nodes.length).toBe(before);

    blueprint.history.redo();
    expect(blueprint.nodes.length).toBe(before + 1);
  });

  it("undo of wire creation removes the wire", () => {
    blueprint.createNewFile();
    blueprint.history.clear();
    blueprint.history.initGraphState(blueprint.mainGraphId, blueprint._exportGraphState(blueprint.mainGraph));

    const a = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const b = api.nodes.create({ typeKey: "math", x: 200, y: 0 });

    const beforeWires = blueprint.wires.length;
    api.wires.create({
      from: { nodeId: a.id, kind: "output", index: 0 },
      to: { nodeId: b.id, kind: "input", index: 0 },
    });
    expect(blueprint.wires.length).toBeGreaterThan(beforeWires);

    const afterCreate = blueprint.wires.length;
    blueprint.history.undo();
    expect(blueprint.wires.length).toBeLessThan(afterCreate);
  });

  it("after undo, exportState matches pre-change snapshot", () => {
    const snap = blueprint.exportState();
    api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    blueprint.history.undo();
    const after = blueprint.exportState();
    expect(after.nodes.length).toBe(snap.nodes.length);
    expect(after.wires.length).toBe(snap.wires.length);
  });
});

// ────────────────────────────────────────────────────────────────
// Snapshot fidelity — what restore has to put back
// ────────────────────────────────────────────────────────────────

describe("restore fidelity", () => {
  // The undo snapshot used to drop the node's constant binding while the
  // loader still read it back, so every constant node came out of an undo with
  // no type and emitting `const_Unknown`.
  it("a constant node keeps its binding through undo and redo", () => {
    api.constants.create({ name: "Amount", type: "float", value: 0.25 });
    const constant = blueprint.constants[0];
    const node = blueprint.createConstantNode(constant, 0, 0);
    const out = blueprint.nodes.find((n) => n.nodeType === NODE_TYPES.output);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(node.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], out.inputPorts[0]);
    blueprint.history.pushState("setup");

    unrelatedEdit();
    blueprint.history.undo();

    const restored = blueprint.nodes.find((n) => n.constantId !== undefined);
    expect(restored).toBeDefined();
    expect(restored.constantId).toBe(constant.id);
    expect(restored.constantType).toBe("float");
    expect(restored.constantName).toBe("const_Amount");
    expect(restored.outputPorts[0].getResolvedType()).toBe("float");

    const src = blueprint.generateAllShaders().webgl1;
    expect(src).toContain("const float const_Amount");
    expect(src).not.toContain("const_Unknown");
  });

  // The pin is an object reference into graph.nodes, and restore rebuilds
  // every node. Left stale, codegen walked the pre-undo graph.
  it("the preview pin follows the rebuilt node instead of dangling", () => {
    const created = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    const node = blueprint.nodes.find((n) => n.id === created.id);
    blueprint.previewNode = node;

    unrelatedEdit();
    blueprint.history.undo();

    expect(blueprint.previewNode).not.toBeNull();
    expect(blueprint.previewNode.id).toBe(created.id);
    expect(blueprint.nodes).toContain(blueprint.previewNode);
  });

  it("the preview pin is dropped when undo removes the pinned node", () => {
    blueprint.history.pushState("setup");
    defeatCoalescing();
    const created = api.nodes.create({ typeKey: "floatInput", x: 0, y: 0 });
    blueprint.previewNode = blueprint.nodes.find((n) => n.id === created.id);

    blueprint.history.undo(); // removes the node the pin points at

    expect(blueprint.previewNode).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// Differ coverage — pushes that used to diff to nothing
// ────────────────────────────────────────────────────────────────

describe("change detection", () => {
  function wireWithReroute() {
    const a = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const b = blueprint.addNode(400, 0, NODE_TYPES.toVec4);
    const wire = connect(a.outputPorts[0], b.inputPorts[0]);
    const reroute = wire.addRerouteNode(200, 50);
    blueprint.history.pushState("Add reroute node");
    return { wire, reroute };
  }

  // wireToString encodes the reroute *count* only, so a pure move diffed to
  // zero properties: pushState("Move reroute nodes") recorded nothing at all.
  it("moving a reroute node records an entry and undo restores it", () => {
    const { reroute } = wireWithReroute();
    const before = blueprint.history.undoStack.length;

    defeatCoalescing();
    reroute.x = 260;
    reroute.y = 310;
    blueprint.history.pushState("Move reroute nodes");

    expect(blueprint.history.undoStack.length).toBe(before + 1);

    blueprint.history.undo();
    const restored = blueprint.wires.find((w) => w.rerouteNodes.length > 0)
      .rerouteNodes[0];
    expect(restored.x).toBe(200);
    expect(restored.y).toBe(50);
  });

  it("changing a Get Variable's selected variable is a detected change", () => {
    const node = blueprint.addNode(0, 0, NODE_TYPES.getVariable);
    blueprint.history.pushState("setup");
    const before = blueprint.history.undoStack.length;

    defeatCoalescing();
    node.selectedVariable = "someVar";
    blueprint.history.pushState("Change variable");

    expect(blueprint.history.undoStack.length).toBe(before + 1);
    blueprint.history.undo();
    expect(
      blueprint.nodes.find((n) => n.nodeType === NODE_TYPES.getVariable)
        .selectedVariable,
    ).toBeFalsy();
  });

  // Removing the nodes and deprecating the record used to be two pushes, so
  // one undo brought the uniform back without its node.
  it("deprecating a uniform with live nodes is one entry", () => {
    api.uniforms.create({ name: "Amount", type: "float" });
    const uniform = blueprint.uniforms[0];
    blueprint.createUniformNode(uniform, 0, 0);
    blueprint.history.pushState("setup");
    const before = blueprint.history.undoStack.length;

    defeatCoalescing();
    blueprint.deleteUniform(uniform.id);

    expect(blueprint.history.undoStack.length).toBe(before + 1);
    expect(blueprint.uniforms).toHaveLength(0);
    expect(blueprint.deprecatedUniforms).toHaveLength(1);
    expect(blueprint.nodes.some((n) => n.uniformId === uniform.id)).toBe(false);

    blueprint.history.undo();
    expect(blueprint.uniforms).toHaveLength(1);
    expect(blueprint.deprecatedUniforms).toHaveLength(0);
    expect(blueprint.nodes.some((n) => n.uniformId === uniform.id)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// The reported bug, through the real handler
// ────────────────────────────────────────────────────────────────

describe("deleting a wire by dragging it off a port", () => {
  // What onMouseDown leaves behind after grabbing a wire by its input port:
  // the wire is already off the graph, and `wasPickedUp` marks it as a wire
  // that existed rather than a drag from a bare port.
  function pickUpWire(wire) {
    wire.endPort.connections = [];
    blueprint.activeWire = wire;
    blueprint.disconnectWire(wire);
    blueprint.activeWire.endPort = null;
    blueprint.activeWire.wasPickedUp = true;
  }

  function connectedPair() {
    const a = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const b = blueprint.addNode(400, 0, NODE_TYPES.toVec4);
    const wire = connect(a.outputPorts[0], b.inputPorts[0]);
    blueprint.history.pushState("setup");
    defeatCoalescing();
    return { a, b, wire };
  }

  const countPairWires = () =>
    blueprint.wires.filter(
      (w) =>
        w.startPort.node.nodeType === NODE_TYPES.floatInput &&
        w.endPort.node.nodeType === NODE_TYPES.toVec4,
    ).length;

  it("records an entry, and undo brings the wire back", () => {
    const { wire } = connectedPair();
    const before = blueprint.history.undoStack.length;

    pickUpWire(wire);
    // Released far from any port.
    blueprint.onMouseUp({ clientX: 5000, clientY: 5000 });

    expect(countPairWires()).toBe(0);
    expect(blueprint.history.undoStack.length).toBe(before + 1);

    blueprint.history.undo();
    expect(countPairWires()).toBe(1);
  });

  it("does not leak into the next undo entry", () => {
    const { wire } = connectedPair();
    pickUpWire(wire);
    blueprint.onMouseUp({ clientX: 5000, clientY: 5000 });
    expect(countPairWires()).toBe(0);

    unrelatedEdit();
    blueprint.history.undo();

    expect(countPairWires()).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────
// The no-leak invariant: do X, do something unrelated, undo once,
// and X must still be there.
// ────────────────────────────────────────────────────────────────

describe("edits do not leak into the next undo entry", () => {
  const settingsEl = (id) => document.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new window.Event(type));

  // Each case mutates something, and reports how to read the result back.
  const CASES = [
    {
      name: "shader settings checkbox",
      act: () => {
        const box = settingsEl("settingAnimated");
        box.checked = true;
        fire(box, "change");
      },
      read: () => blueprint.shaderSettings.animated,
      expected: true,
    },
    {
      name: "shader settings text field",
      act: () => {
        const input = settingsEl("settingAuthor");
        input.value = "Ada";
        fire(input, "input");
        fire(input, "change");
      },
      read: () => blueprint.shaderSettings.author,
      expected: "Ada",
    },
    {
      name: "uniform description",
      act: () => {
        api.uniforms.create({ name: "Amount", type: "float" });
        blueprint.renderUniformList();
        defeatCoalescing();
        // The param-ID field reuses the same class and comes first.
        const input = blueprint.uniformList.querySelector(
          ".uniform-description-input:not(.uniform-param-id-inline)",
        );
        input.value = "how much";
        fire(input, "change");
      },
      read: () => blueprint.uniforms[0]?.description,
      expected: "how much",
    },
    {
      // The sidebar reads the new order off the DOM, so reorder the rendered
      // rows the way a drag would and let the real drop handler run.
      name: "uniform reorder",
      act: () => {
        api.uniforms.create({ name: "First", type: "float" });
        api.uniforms.create({ name: "Second", type: "float" });
        blueprint.renderUniformList();
        defeatCoalescing();

        const list = blueprint.uniformList;
        const rows = [...list.children].reverse();
        rows.forEach((row) => list.appendChild(row));

        const drop = new window.Event("drop");
        drop.dataTransfer = { getData: () => list.children[0].dataset.uniformId };
        list.children[0].dispatchEvent(drop);
      },
      read: () => blueprint.uniforms.map((u) => u.name).join(","),
      expected: "Second,First",
    },
    {
      name: "constant description",
      act: () => {
        api.constants.create({ name: "Steps", type: "int", value: 4 });
        blueprint.renderConstantList();
        defeatCoalescing();
        const input = blueprint.constantList.querySelector(
          ".uniform-description-input",
        );
        input.value = "iteration count";
        fire(input, "change");
      },
      read: () => blueprint.constants[0]?.description,
      expected: "iteration count",
    },
    {
      // The reported bug: dragging a wire off a port and dropping it on empty
      // canvas deletes it, and used to record nothing.
      name: "wire deletion",
      act: () => {
        const a = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
        const b = blueprint.addNode(400, 0, NODE_TYPES.toVec4);
        const wire = connect(a.outputPorts[0], b.inputPorts[0]);
        blueprint.history.pushState("setup");
        defeatCoalescing();
        blueprint.disconnectWire(wire);
        blueprint.history.pushState("Delete wire");
      },
      // Counted by endpoint types: createNewFile seeds the graph with wires
      // of its own, so an absolute wire count would say nothing.
      read: () =>
        blueprint.wires.filter(
          (w) =>
            w.startPort.node.nodeType === NODE_TYPES.floatInput &&
            w.endPort.node.nodeType === NODE_TYPES.toVec4,
        ).length,
      expected: 0,
    },
    {
      name: "reroute node deletion",
      act: () => {
        const a = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
        const b = blueprint.addNode(400, 0, NODE_TYPES.toVec4);
        const wire = connect(a.outputPorts[0], b.inputPorts[0]);
        const reroute = wire.addRerouteNode(200, 50);
        blueprint.history.pushState("setup");
        defeatCoalescing();
        wire.removeRerouteNode(reroute);
        blueprint.history.pushState("Delete reroute node");
      },
      read: () => blueprint.wires.filter((w) => w.rerouteNodes.length > 0).length,
      expected: 0,
    },
  ];

  for (const testCase of CASES) {
    it(`survives an undo of a later edit: ${testCase.name}`, () => {
      testCase.act();
      expect(testCase.read()).toEqual(testCase.expected);

      unrelatedEdit();
      blueprint.history.undo();

      expect(testCase.read()).toEqual(testCase.expected);
    });
  }
});

// ────────────────────────────────────────────────────────────────
// Graph lifecycle
// ────────────────────────────────────────────────────────────────

describe("deleted graphs", () => {
  it("deleting a graph drops the undo entries that only touched it", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fn.id);
    blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    blueprint.history.pushState("edit in Fn");
    expect(
      blueprint.history.undoStack.some((e) =>
        e.graphs.some((g) => g.graphId === fn.id),
      ),
    ).toBe(true);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    blueprint.deleteGraph(fn.id);

    expect(
      blueprint.history.undoStack.some((e) =>
        e.graphs.some((g) => g.graphId === fn.id),
      ),
    ).toBe(false);
    expect(blueprint.history.currentStates.has(fn.id)).toBe(false);
  });
});
