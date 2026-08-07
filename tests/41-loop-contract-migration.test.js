// Issues #122 and #123 — loop body accumulators used to be stored twice.
//
// Old shape: `contract.inputs` held accumulators and arguments interleaved,
// each tagged with a `role`, and `contract.outputs` held a second copy of every
// accumulator paired by id. The two copies could drift in name, in type and in
// order, and the add/delete buttons could leave states with no valid reading.
//
// New shape: `contract.outputs` holds the accumulators, `contract.inputs` the
// arguments, and there is no role field. These tests cover the load migration
// for files written in the old shape.
//
// The order remap is the delicate part. The body's FunctionInput node exposes
// [Index, Count, ...accumulators, ...arguments], and wires are restored by port
// index — so a file whose accumulators and arguments were interleaved has to
// have its wire endpoints moved, or the body silently rewires itself.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function fakeFile(json) {
  return { name: "legacy.c3sg", text: async () => JSON.stringify(json) };
}

// A saved project containing one loopBody graph in the OLD contract shape.
// `contractInputs` is the legacy interleaved list; `contractOutputs` the
// legacy paired copies. `wires` are FunctionInput → math wires given by the
// legacy port index.
function legacyProject({ contractInputs, contractOutputs, wires = [] }) {
  return {
    version: "1.0.0",
    shaderSettings: { name: "Legacy" },
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    wires: [],
    comments: [],
    uniforms: [],
    _additionalGraphs: [
      {
        id: "g_legacy",
        name: "OldLoop",
        kind: "loopBody",
        color: null,
        contractVersion: 1,
        data: {
          notes: "",
          contract: { inputs: contractInputs, outputs: contractOutputs },
        },
        shaderSettings: {},
        camera: { x: 0, y: 0, zoom: 1 },
        nodes: [
          {
            id: 1,
            x: 0,
            y: 0,
            nodeTypeKey: "functionInput",
            inputPorts: [],
            outputPorts: [],
          },
          {
            id: 2,
            x: 400,
            y: 0,
            nodeTypeKey: "functionOutput",
            inputPorts: [],
            outputPorts: [],
          },
          {
            id: 3,
            x: 200,
            y: 0,
            nodeTypeKey: "math",
            inputPorts: [],
            outputPorts: [],
          },
        ],
        wires,
        comments: [],
      },
    ],
  };
}

async function loadLegacy(project) {
  await blueprint.loadFromJSON(fakeFile(project));
  return [...blueprint.graphs.values()].find((g) => g.name === "OldLoop");
}

describe("LEGACY LOOP CONTRACT MIGRATION (#122, #123)", () => {
  it("moves accumulators into outputs and drops the role field", async () => {
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [
          { id: "a1", name: "sum", type: "float", role: "acc" },
          { id: "s1", name: "step", type: "float", role: "arg" },
        ],
        contractOutputs: [{ id: "a1", name: "sum", type: "float" }],
      }),
    );

    expect(g.data.contract.outputs).toHaveLength(1);
    expect(g.data.contract.outputs[0].name).toBe("sum");
    expect(g.data.contract.inputs).toHaveLength(1);
    expect(g.data.contract.inputs[0].name).toBe("step");
    for (const p of [...g.data.contract.inputs, ...g.data.contract.outputs]) {
      expect(p.role).toBeUndefined();
    }
  });

  it("keeps body wires on the ports they were on when order changes", async () => {
    // Legacy interleaving: [Index, Count, step(arg), sum(acc)].
    // New order:           [Index, Count, sum(acc), step(arg)].
    // The wire below was on legacy index 3 (sum) and must end up on 2.
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [
          { id: "s1", name: "step", type: "float", role: "arg" },
          { id: "a1", name: "sum", type: "float", role: "acc" },
        ],
        contractOutputs: [{ id: "a1", name: "sum", type: "float" }],
        wires: [
          { startNodeId: 1, startPortIndex: 3, endNodeId: 3, endPortIndex: 0 },
        ],
      }),
    );

    const fnIn = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const wire = g.wires[0];
    expect(wire).toBeDefined();
    // Still attached to "sum", wherever "sum" now sits.
    expect(wire.startPort.name).toBe("sum");
    expect(wire.startPort).toBe(fnIn.outputPorts[2]);
  });

  it("keeps FunctionOutput wires when the stored outputs were reordered", async () => {
    // The old editor's Outputs list had its own drag-to-reorder, independent of
    // the inputs, so a file can have accumulator inputs in one order and the
    // stored outputs in another. Rebuilding outputs in acc-input order permutes
    // the FunctionOutput node's ports, and its wires are restored by index.
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [
          { id: "a_sum", name: "sum", type: "float", role: "acc" },
          { id: "a_prod", name: "prod", type: "float", role: "acc" },
        ],
        // Reordered relative to the inputs.
        contractOutputs: [
          { id: "a_prod", name: "prod", type: "float" },
          { id: "a_sum", name: "sum", type: "float" },
        ],
        // FunctionOutput port 1 meant "sum" under the stored order.
        wires: [
          { startNodeId: 1, startPortIndex: 2, endNodeId: 2, endPortIndex: 1 },
        ],
      }),
    );

    const wire = g.wires[0];
    expect(wire).toBeDefined();
    expect(wire.startPort.name).toBe("sum");
    expect(wire.endPort.name).toBe("sum");
  });

  it("leaves Index and Count wires alone", async () => {
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [
          { id: "s1", name: "step", type: "float", role: "arg" },
          { id: "a1", name: "sum", type: "float", role: "acc" },
        ],
        contractOutputs: [{ id: "a1", name: "sum", type: "float" }],
        wires: [
          { startNodeId: 1, startPortIndex: 0, endNodeId: 3, endPortIndex: 0 },
          { startNodeId: 1, startPortIndex: 1, endNodeId: 3, endPortIndex: 1 },
        ],
      }),
    );

    expect(g.wires[0].startPort.name).toBe("Index");
    expect(g.wires[1].startPort.name).toBe("Count");
  });

  it("takes the accumulator's name and type from the input side when they drifted", async () => {
    // #123: editing the output row used to desync the pair permanently. The
    // input is the side codegen used for parameter types, so it wins.
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [{ id: "a1", name: "sum", type: "vec3", role: "acc" }],
        contractOutputs: [{ id: "a1", name: "drifted", type: "float" }],
      }),
    );

    expect(g.data.contract.outputs).toHaveLength(1);
    expect(g.data.contract.outputs[0].name).toBe("sum");
    expect(g.data.contract.outputs[0].type).toBe("vec3");
  });

  it("keeps an orphan output that used to be a hard validation error", async () => {
    // Reachable via the old "+ Add Output", which pushed an output with a new
    // id that paired with nothing — and whose delete button was disabled, so
    // it could never be removed. It is just an accumulator now.
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
        contractOutputs: [
          { id: "a1", name: "sum", type: "float" },
          { id: "orphan", name: "stuck", type: "float" },
        ],
      }),
    );

    const names = g.data.contract.outputs.map((p) => p.name);
    expect(names).toContain("sum");
    expect(names).toContain("stuck");
  });

  it("promotes an accumulator input that never got its paired output", async () => {
    // The mirror of the above, reachable via the old "+ Add Input".
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [{ id: "a1", name: "sum", type: "float", role: "acc" }],
        contractOutputs: [],
      }),
    );

    expect(g.data.contract.outputs).toHaveLength(1);
    expect(g.data.contract.outputs[0].name).toBe("sum");
  });

  it("produces a contract that validates, and re-saves in the new shape", async () => {
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [
          { id: "a1", name: "sum", type: "float", role: "acc" },
          { id: "s1", name: "step", type: "float", role: "arg" },
        ],
        contractOutputs: [{ id: "a1", name: "sum", type: "float" }],
      }),
    );

    const { loopBodyKindHandler } = await import(
      "../graph-kinds/loop-body-kind.js"
    );
    expect(loopBodyKindHandler.validateContract(g.data.contract)).toEqual([]);

    const resaved = JSON.parse(blueprint.serializeProjectToJSON());
    const extra = resaved._additionalGraphs.find((e) => e.name === "OldLoop");
    expect(JSON.stringify(extra.data.contract)).not.toContain("role");
  });

  it("rebuilds caller nodes in the parent graph from the migrated contract", async () => {
    // Caller node types are derived from the contract while the MAIN graph's
    // nodes load, which happens before the additional graphs' payloads. If the
    // migration ran later, the caller would be built from the old shape — wrong
    // port count, and its wires are restored by index.
    const project = legacyProject({
      contractInputs: [
        { id: "a_sum", name: "sum", type: "float", role: "acc" },
        { id: "s_step", name: "step", type: "float", role: "arg" },
        { id: "a_prod", name: "prod", type: "float", role: "acc" },
      ],
      contractOutputs: [
        { id: "a_sum", name: "sum", type: "float" },
        { id: "a_prod", name: "prod", type: "float" },
      ],
    });
    // A caller in main, with something wired into its "step" argument port
    // (index 3 under both the old and the new derivation).
    project.nodes = [
      {
        id: 10,
        x: 0,
        y: 0,
        nodeTypeKey: "function_call_g_legacy",
        inputPorts: [],
        outputPorts: [],
      },
      {
        id: 11,
        x: -200,
        y: 0,
        nodeTypeKey: "floatInput",
        inputPorts: [],
        outputPorts: [],
      },
    ];
    project.wires = [
      { startNodeId: 11, startPortIndex: 0, endNodeId: 10, endPortIndex: 3 },
    ];

    await blueprint.loadFromJSON(fakeFile(project));

    const caller = blueprint.mainGraph.nodes.find(
      (n) => n.nodeType.isFunctionCall,
    );
    expect(caller).toBeDefined();
    expect(caller.inputPorts.map((p) => p.name)).toEqual([
      "Count",
      "Initial sum",
      "Initial prod",
      "step",
    ]);
    expect(blueprint.mainGraph.wires[0].endPort.name).toBe("step");
  });

  it("leaves an already-migrated contract untouched", async () => {
    const g = await loadLegacy(
      legacyProject({
        contractInputs: [{ id: "s1", name: "step", type: "float" }],
        contractOutputs: [{ id: "a1", name: "sum", type: "float" }],
      }),
    );

    expect(g.data.contract.inputs.map((p) => p.name)).toEqual(["step"]);
    expect(g.data.contract.outputs.map((p) => p.name)).toEqual(["sum"]);
  });
});
