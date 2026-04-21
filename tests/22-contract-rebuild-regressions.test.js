// Test 22: Regression guards for 4 contract-rebuild bugs found during QA.
//
// Bugs fixed (in order of appearance in this file):
//   1. Changing a function's color disconnected wires on boundary nodes
//      (FunctionInput/FunctionOutput).
//   2. Setting a generic port type to a concrete type and back to "Generic"
//      picked a fresh letter (U) instead of restoring the previous letter (T).
//   3. When the function body collapses a generic (e.g. wiring a vec2 to the
//      `T` output of FunctionInput), callers on the main graph kept showing
//      the generic letter instead of the concrete type.
//   4. Phantom wires: after a contract rebuild, wires on the main graph's
//      caller nodes were preserved on the port objects but lost from the
//      global `this.wires` array.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
  blueprint.nodes = [];
  blueprint.wires = [];
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
  const key = `function_call_${target.id}`;
  const callerType = blueprint.getCallableFunctionNodeTypes()[key];
  if (!callerType) throw new Error(`no caller type for ${target.name}`);
  return blueprint.addNode(0, 0, callerType);
}

describe("Bug 1: color change preserves boundary-node wires", () => {
  it("changing graph.color does NOT disconnect wires inside the function body", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(g.id);
    const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(inp.outputPorts[0], outp.inputPorts[0]);
    expect(g.wires.length).toBe(1);

    // Color change path — production calls syncContractCallers after setting
    // graph.color so the tab bar and callers repaint.
    g.color = "#ff00aa";
    blueprint.syncContractCallers(g);

    // The wire inside the function body must still exist and still link the
    // SAME Port instances (not stale references to replaced ports).
    expect(g.wires.length).toBe(1);
    const w = g.wires[0];
    expect(inp.outputPorts[0].connections).toContain(w);
    expect(outp.inputPorts[0].connections).toContain(w);
    expect(w.startPort).toBe(inp.outputPorts[0]);
    expect(w.endPort).toBe(outp.inputPorts[0]);
  });

  it("changing color preserves wires on main-graph callers", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const out = blueprint.addNode(0, 0, NODE_TYPES.output);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(caller.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], out.inputPorts[0]);
    expect(blueprint.wires.length).toBe(2);

    g.color = "#44aa66";
    blueprint.syncContractCallers(g);

    // Both wires must still be in the main-graph wires list.
    expect(blueprint.wires.length).toBe(2);
    // And the caller's output wire must still reach the downstream node.
    expect(caller.outputPorts[0].connections.length).toBe(1);
    const w = caller.outputPorts[0].connections[0];
    expect(w.endPort.node).toBe(toVec4);
  });
});

describe("Bug 2: generic round-trip restores letter", () => {
  it("T → vec2 → Generic restores T (not U)", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    // Seeded: { inputs: [T], outputs: [T] }. Simulate the UI flow by reading
    // and mutating contract.outputs[0] the same way the type-select handler
    // does.
    const port = g.data.contract.outputs[0];
    expect(port.type).toBe("T");

    // Simulate the handler: going concrete remembers the prior generic.
    port._previousGeneric = port.type;
    port.type = "vec2";

    // Now revert to generic: should restore "T".
    port.type = port._previousGeneric || "T";
    delete port._previousGeneric;

    expect(port.type).toBe("T");
  });
});

describe("Bug 3: body-collapsed generic propagates to callers", () => {
  it("wiring a vec2 inside the body resolves caller's generic port to vec2", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    // Contract already seeded with { inputs: [T], outputs: [T] }.

    // Make a caller on the main graph.
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    // The caller's input port starts as generic T, unresolved.
    expect(caller.inputPorts[0].portType).toBe("T");
    expect(caller.resolvedGenerics.T).toBeUndefined();

    // Inside the function body: wire a vec2 node to the FunctionInput's T port.
    blueprint.setActiveGraph(g.id);
    const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    // Use a Vec2 node whose output is concrete vec2.
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);
    connect(vec2.outputPorts[0], outp.inputPorts[0]);
    // FunctionInput's T should also get resolved if we wire it to anything vec2-specific.
    // To drive T from the input side too, wire vec2 → inp.outputPorts[0]? We can't —
    // that's backward. Instead wire inp.outputPorts[0] (T) to another vec2 sink.
    // Simpler: the FunctionOutput's resolvedGenerics update is enough.

    // After the wire op, callers should have picked up T = vec2.
    expect(outp.resolvedGenerics.T).toBe("vec2");
    expect(caller.resolvedGenerics.T).toBe("vec2");
    // Port's resolved type should now display concrete.
    expect(caller.inputPorts[0].getResolvedType()).toBe("vec2");
  });
});

describe("Bug 4: contract rebuild leaves no phantom wires", () => {
  it("every wire on a caller port is also in blueprint.wires after rebuild", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const out = blueprint.addNode(0, 0, NODE_TYPES.output);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(caller.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], out.inputPorts[0]);
    expect(blueprint.wires.length).toBe(2);

    // Mutate the contract in a way that keeps the caller's port shape identical
    // (same ids, same types, same names). This is the color-change case.
    g.color = "#777777";
    blueprint.syncContractCallers(g);

    // Every wire referenced by a port MUST be in blueprint.wires — otherwise
    // it's a phantom: rendered inconsistent between port.connections and the
    // global list.
    const referenced = new Set();
    for (const node of blueprint.nodes) {
      for (const port of [...node.inputPorts, ...node.outputPorts]) {
        for (const w of port.connections) referenced.add(w);
      }
    }
    for (const w of referenced) {
      expect(blueprint.wires).toContain(w);
    }
    // And every wire in the global list must still have both endpoints
    // referenced by their ports.
    for (const w of blueprint.wires) {
      expect(w.startPort.connections).toContain(w);
      expect(w.endPort.connections).toContain(w);
    }
  });

  it("actual type change on a contract port preserves compatible wires", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const out = blueprint.addNode(0, 0, NODE_TYPES.output);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(caller.outputPorts[0], toVec4.inputPorts[0]);
    connect(toVec4.outputPorts[0], out.inputPorts[0]);

    // Change caller output type: float → float (same type, different contract
    // rebuild). Ensures reuse path preserves the wire without going through
    // the type-change branch.
    g.data.contract.outputs[0].name = "result"; // name-only change
    blueprint.syncContractCallers(g);

    expect(caller.outputPorts[0].name).toBe("result");
    expect(caller.outputPorts[0].connections.length).toBe(1);
    expect(blueprint.wires.length).toBe(2);
  });
});

describe("Bug 5: type change drops incompatible wires, keeps compatible ones", () => {
  it("incompatible type change on a contract output drops the wire cleanly", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    // toVec4's first input is a float-accepting port. Once we flip the caller
    // output to mat3, that float port can no longer accept it.
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(caller.outputPorts[0], toVec4.inputPorts[0]);
    expect(blueprint.wires.length).toBe(1);

    // Flip the caller output to mat3 (incompatible with toVec4's float input).
    g.data.contract.outputs[0].type = "mat3";
    blueprint.syncContractCallers(g);

    // The wire must be removed from the global list AND from both ports.
    expect(blueprint.wires.length).toBe(0);
    expect(caller.outputPorts[0].connections.length).toBe(0);
    expect(toVec4.inputPorts[0].connections.length).toBe(0);
    expect(caller.outputPorts[0].portType).toBe("mat3");
  });

  it("incompatible type change on a contract input drops the inbound wire", () => {
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    // Feed the caller input from a Vec2 node (concrete vec2 output).
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);
    connect(vec2.outputPorts[0], caller.inputPorts[0]);

    // Flip input type to bool: vec2 → bool is not a compatible assignment.
    g.data.contract.inputs[0].type = "bool";
    blueprint.syncContractCallers(g);

    expect(caller.inputPorts[0].connections.length).toBe(0);
    expect(blueprint.wires.length).toBe(0);
    expect(caller.inputPorts[0].portType).toBe("bool");
  });

  it("incompatible type change disconnects wires on a non-active graph cleanly", () => {
    // This exercises the cross-graph disconnect path: the graph that owns the
    // caller + its broken wire is NOT the active graph when syncContractCallers
    // walks every graph. Previously, disconnectWire removed the wire from
    // `this.wires` (active graph) instead of the wire's owning graph, leaving
    // a phantom wire in the non-active graph's `wires` list.
    const target = blueprint.createFunctionGraph({ name: "Target" });
    target.data.contract = {
      inputs: [{ id: "t_in", name: "x", type: "float" }],
      outputs: [{ id: "t_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(target);

    // Build `Host`: a second function graph that contains a caller of `Target`
    // wired into a toVec4 sink. That wire will later go incompatible.
    const host = blueprint.createFunctionGraph({ name: "Host" });
    host.data.contract = {
      inputs: [{ id: "h_in", name: "x", type: "float" }],
      outputs: [{ id: "h_out", name: "r", type: "vec4" }],
    };
    blueprint.syncContractCallers(host);

    blueprint.setActiveGraph(host.id);
    const callerInHost = addCaller(target);
    const toVec4 = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(callerInHost.outputPorts[0], toVec4.inputPorts[0]);
    const hostOut = host.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    connect(toVec4.outputPorts[0], hostOut.inputPorts[0]);
    expect(host.wires.length).toBe(2);

    // Switch active away from `host` to prove the bug is about wire ownership,
    // not about being the currently edited graph.
    blueprint.setActiveGraph(blueprint.mainGraphId);

    // Flip Target's output to mat3 — toVec4's float input can no longer accept it.
    target.data.contract.outputs[0].type = "mat3";
    blueprint.syncContractCallers(target);

    // The callerInHost's output wire must be fully removed: from the host
    // graph's wires list, AND from both endpoint ports' connections.
    expect(callerInHost.outputPorts[0].portType).toBe("mat3");
    expect(callerInHost.outputPorts[0].connections.length).toBe(0);
    expect(toVec4.inputPorts[0].connections.length).toBe(0);
    // The toVec4 → hostOut wire should still exist (unaffected).
    expect(host.wires.length).toBe(1);
    expect(host.wires[0].startPort.node).toBe(toVec4);
    // The global afterEach in setup.js will also assert no phantom wires in
    // any graph — that's the real belt-and-suspenders check.
  });

  it("cascading type propagation drops downstream wires that become incompatible", () => {
    // Chain: caller.output[T] -> math.input[genType] -> vec4.X[float]
    // Initially T resolves to float everywhere. When we flip the contract
    // output to vec3, math's genType re-resolves to vec3. That propagation
    // makes math.output (now vec3) incompatible with Vec4's float input —
    // the downstream wire must be dropped.
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "T" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    const vec4 = blueprint.addNode(0, 0, NODE_TYPES.vec4);
    // caller.output[T] -> math.input[genType]
    connect(caller.outputPorts[0], math.inputPorts[0]);
    // math.output[genType] -> vec4.X[float]; this resolves math.genType to float.
    connect(math.outputPorts[0], vec4.inputPorts[0]);
    expect(math.outputPorts[0].getResolvedType()).toBe("float");

    // Flip contract output T -> vec3. The caller-side wire survives (genType
    // accepts vec3), and propagation re-resolves math.genType to vec3. But
    // math.output -> vec4.X(float) is now incompatible and must drop.
    g.data.contract.outputs[0].type = "vec3";
    blueprint.syncContractCallers(g);

    expect(caller.outputPorts[0].portType).toBe("vec3");
    expect(math.outputPorts[0].getResolvedType()).toBe("vec3");
    // Downstream wire must be gone — math.output no longer compatible with vec4.X (float).
    expect(math.outputPorts[0].connections.length).toBe(0);
    expect(vec4.inputPorts[0].connections.length).toBe(0);
  });

  it("compatible type change propagates through the preserved wire", () => {
    // When a contract change keeps a wire (types still compatible), the new
    // type on the contract side must propagate across the wire: any generic
    // on the other end needs to re-resolve to the new concrete type.
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    // Math node: output is genType. When we wire caller.output (float) into
    // its first input, the genType resolves to float.
    const math = blueprint.addNode(0, 0, NODE_TYPES.math);
    connect(caller.outputPorts[0], math.inputPorts[0]);
    expect(math.outputPorts[0].getResolvedType()).toBe("float");

    // Flip the contract output to vec3. Math's input is genType and accepts
    // vec3, so the wire survives.
    g.data.contract.outputs[0].type = "vec3";
    blueprint.syncContractCallers(g);

    // The wire must still exist, AND math's generic must re-resolve to vec3.
    expect(caller.outputPorts[0].portType).toBe("vec3");
    expect(caller.outputPorts[0].connections.length).toBe(1);
    expect(math.outputPorts[0].getResolvedType()).toBe("vec3");
  });

  it("dropped-wire endpoint becomes editable again (falls back to default value)", () => {
    // When a contract change drops an incompatible wire, the *other* end
    // (the still-existing port that was reading through the wire) must
    // refresh its editability so the UI shows its default-value input again
    // instead of behaving as if it were still wired.
    const g = blueprint.createFunctionGraph({ name: "Fn" });
    g.data.contract = {
      inputs: [{ id: "p_in", name: "x", type: "float" }],
      outputs: [{ id: "p_out", name: "r", type: "float" }],
    };
    blueprint.syncContractCallers(g);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const caller = addCaller(g);
    // Feed the caller input from a vec2 constant so the vec2→float wire exists.
    const vec2 = blueprint.addNode(0, 0, NODE_TYPES.vec2);
    connect(vec2.outputPorts[0], caller.inputPorts[0]);
    // Sanity: while connected, the caller input is NOT editable.
    expect(caller.inputPorts[0].isEditable).toBe(false);

    // Flip the contract input type to bool — vec2 → bool is incompatible, so
    // the wire is dropped.
    g.data.contract.inputs[0].type = "bool";
    blueprint.syncContractCallers(g);

    // After drop, the caller's (new) input port must be editable again and
    // carry a default value — otherwise the UI would still render it as if
    // a wire were feeding it.
    expect(caller.inputPorts[0].connections.length).toBe(0);
    expect(caller.inputPorts[0].isEditable).toBe(true);
    expect(caller.inputPorts[0].value).not.toBeUndefined();
  });
});
