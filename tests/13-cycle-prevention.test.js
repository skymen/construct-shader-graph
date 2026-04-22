// Test 13: Cycle / recursion prevention (Phase 6)
//
// Verifies:
// - Direct self-call (A→A) is rejected
// - Indirect cycle (A→B→A) is rejected
// - Deep cycles (A→B→C→A) are caught
// - Adding a non-cycle-creating caller succeeds
// - getCallDAG correctly reflects caller edges
// - Pre-codegen validation catches cycles in loaded files
// - wouldCreateCycle works from main graph too

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function connect(blueprint, srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  return wire;
}

describe("Cycle / recursion prevention — Phase 6", () => {
  describe("getCallDAG", () => {
    it("returns an empty DAG when no callable graphs exist", async () => {
      const { getCallDAG } = await import("../graph-kinds/index.js");
      const dag = getCallDAG(blueprint);
      expect(dag.size).toBeGreaterThan(0); // main graph exists
      for (const deps of dag.values()) {
        expect(deps.size).toBe(0);
      }
    });

    it("reflects caller edges after adding a function call node", async () => {
      const { getCallDAG } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      // Put a caller to B inside A
      blueprint.setActiveGraph(fnA.id);
      const { getHandler } = await import("../graph-kinds/index.js");
      const handler = getHandler(fnB.kind);
      const callerType = handler.createCallerNodeType(fnB, blueprint);
      blueprint.addNode(0, 0, callerType);

      const dag = getCallDAG(blueprint);
      expect(dag.get(fnA.id).has(fnB.id)).toBe(true);
      expect(dag.get(fnB.id).has(fnA.id)).toBe(false);
    });
  });

  describe("wouldCreateCycle", () => {
    it("rejects direct self-call (A→A)", async () => {
      const { wouldCreateCycle } = await import("../graph-kinds/index.js");
      const fnA = blueprint.createFunctionGraph({ name: "SelfRef" });
      expect(wouldCreateCycle(blueprint, fnA.id, fnA.id)).toBe(true);
    });

    it("rejects indirect cycle (A→B→A)", async () => {
      const { wouldCreateCycle, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      // A calls B
      blueprint.setActiveGraph(fnA.id);
      const handlerB = getHandler(fnB.kind);
      const callerTypeB = handlerB.createCallerNodeType(fnB, blueprint);
      blueprint.addNode(0, 0, callerTypeB);

      // Now check: would B calling A create a cycle? Yes.
      expect(wouldCreateCycle(blueprint, fnB.id, fnA.id)).toBe(true);
    });

    it("rejects deep cycle (A→B→C→A)", async () => {
      const { wouldCreateCycle, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });
      const fnC = blueprint.createFunctionGraph({ name: "C" });

      // A calls B
      blueprint.setActiveGraph(fnA.id);
      const handlerB = getHandler(fnB.kind);
      blueprint.addNode(0, 0, handlerB.createCallerNodeType(fnB, blueprint));

      // B calls C
      blueprint.setActiveGraph(fnB.id);
      const handlerC = getHandler(fnC.kind);
      blueprint.addNode(0, 0, handlerC.createCallerNodeType(fnC, blueprint));

      // Would C calling A create a cycle? Yes.
      expect(wouldCreateCycle(blueprint, fnC.id, fnA.id)).toBe(true);

      // Would C calling B also create a cycle? Yes (B→C→B).
      expect(wouldCreateCycle(blueprint, fnC.id, fnB.id)).toBe(true);
    });

    it("allows non-cycle-creating caller", async () => {
      const { wouldCreateCycle } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });
      const fnC = blueprint.createFunctionGraph({ name: "C" });

      // No edges yet — A calling B should be fine
      expect(wouldCreateCycle(blueprint, fnA.id, fnB.id)).toBe(false);

      // A calling C should also be fine
      expect(wouldCreateCycle(blueprint, fnA.id, fnC.id)).toBe(false);
    });

    it("allows diamond DAG (A→B, A→C, B→D, C→D)", async () => {
      const { wouldCreateCycle, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });
      const fnC = blueprint.createFunctionGraph({ name: "C" });
      const fnD = blueprint.createFunctionGraph({ name: "D" });

      // A calls B
      blueprint.setActiveGraph(fnA.id);
      const hB = getHandler("function");
      blueprint.addNode(0, 0, hB.createCallerNodeType(fnB, blueprint));
      // A calls C
      blueprint.addNode(50, 0, hB.createCallerNodeType(fnC, blueprint));

      // B calls D
      blueprint.setActiveGraph(fnB.id);
      blueprint.addNode(0, 0, hB.createCallerNodeType(fnD, blueprint));

      // C calls D — not a cycle (diamond)
      expect(wouldCreateCycle(blueprint, fnC.id, fnD.id)).toBe(false);

      // D calling A would be a cycle
      expect(wouldCreateCycle(blueprint, fnD.id, fnA.id)).toBe(true);

      // D calling B would be a cycle
      expect(wouldCreateCycle(blueprint, fnD.id, fnB.id)).toBe(true);
    });

    it("works when checking from main graph", async () => {
      const { wouldCreateCycle } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });

      // Main calling A is always fine
      expect(wouldCreateCycle(blueprint, blueprint.mainGraphId, fnA.id)).toBe(false);

      // A calling into main should be treated as a cycle (self-loop on main is blocked)
      expect(wouldCreateCycle(blueprint, blueprint.mainGraphId, blueprint.mainGraphId)).toBe(true);
    });
  });

  describe("getCyclePath", () => {
    it("returns a readable path string for a direct self-call", async () => {
      const { getCyclePath } = await import("../graph-kinds/index.js");
      const fnA = blueprint.createFunctionGraph({ name: "Recurse" });
      const path = getCyclePath(blueprint, fnA.id, fnA.id);
      expect(path).toContain("Recurse");
    });

    it("returns a readable path for an indirect cycle", async () => {
      const { getCyclePath, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "Alpha" });
      const fnB = blueprint.createFunctionGraph({ name: "Beta" });

      // A calls B
      blueprint.setActiveGraph(fnA.id);
      const h = getHandler("function");
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));

      // Path for B→A
      const path = getCyclePath(blueprint, fnB.id, fnA.id);
      expect(path).not.toBeNull();
      expect(path).toContain("Alpha");
      expect(path).toContain("Beta");
    });

    it("returns null when no cycle", async () => {
      const { getCyclePath } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "X" });
      const fnB = blueprint.createFunctionGraph({ name: "Y" });

      const path = getCyclePath(blueprint, fnA.id, fnB.id);
      expect(path).toBeNull();
    });
  });

  describe("detectCycleInDAG", () => {
    it("returns null for an acyclic graph", async () => {
      const { detectCycleInDAG, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      blueprint.setActiveGraph(fnA.id);
      const h = getHandler("function");
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));

      expect(detectCycleInDAG(blueprint)).toBeNull();
    });

    it("detects a cycle when one exists", async () => {
      const { detectCycleInDAG, getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      // A→B
      blueprint.setActiveGraph(fnA.id);
      const h = getHandler("function");
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));

      // Force B→A by directly adding a caller (bypassing the UI guard)
      blueprint.setActiveGraph(fnB.id);
      blueprint.addNode(0, 0, h.createCallerNodeType(fnA, blueprint));

      const cycle = detectCycleInDAG(blueprint);
      expect(cycle).not.toBeNull();
      expect(cycle.length).toBeGreaterThanOrEqual(2);
      expect(cycle).toContain(fnA.id);
      expect(cycle).toContain(fnB.id);
    });
  });

  describe("search menu filtering", () => {
    it("hides function call entries that would create a cycle", async () => {
      const { getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      // A calls B
      blueprint.setActiveGraph(fnA.id);
      const h = getHandler("function");
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));

      // From B's perspective, A should be hidden (would create B→A→B cycle)
      blueprint.setActiveGraph(fnB.id);
      const types = blueprint.getFilteredNodeTypes();
      const fnCallA = types.find(([key]) => key === `function_call_${fnA.id}`);
      expect(fnCallA).toBeUndefined();

      // B should not see itself either
      const fnCallB = types.find(([key]) => key === `function_call_${fnB.id}`);
      expect(fnCallB).toBeUndefined();
    });

    it("shows function call entries that do not create a cycle", async () => {
      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      // No edges — from A, B should be visible
      blueprint.setActiveGraph(fnA.id);
      const types = blueprint.getFilteredNodeTypes();
      const fnCallB = types.find(([key]) => key === `function_call_${fnB.id}`);
      expect(fnCallB).toBeDefined();
    });
  });

  describe("pre-codegen validation", () => {
    it("_validateCallDAG returns empty array for valid project", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Valid" });
      fnGraph.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "float" }],
        outputs: [{ id: "p2", name: "result", type: "float" }],
      };
      blueprint.syncContractCallers(fnGraph);
      const errors = blueprint._validateCallDAG();
      expect(errors).toEqual([]);
    });

    it("_validateCallDAG detects a cycle", async () => {
      const { getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "CycleA" });
      const fnB = blueprint.createFunctionGraph({ name: "CycleB" });

      // A→B
      blueprint.setActiveGraph(fnA.id);
      const h = getHandler("function");
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));

      // Force B→A (bypass guard)
      blueprint.setActiveGraph(fnB.id);
      blueprint.addNode(0, 0, h.createCallerNodeType(fnA, blueprint));

      const errors = blueprint._validateCallDAG();
      const cycleError = errors.find((e) => e.message.includes("Cycle"));
      expect(cycleError).toBeDefined();
    });

    it("_validateCallDAG reports missing boundary nodes", () => {
      const fnGraph = blueprint.createFunctionGraph({ name: "Broken" });
      // Remove the Function Input node
      const inputNode = fnGraph.nodes.find((n) => n.nodeType.name === "Function Input");
      if (inputNode) {
        const idx = fnGraph.nodes.indexOf(inputNode);
        fnGraph.nodes.splice(idx, 1);
      }

      const errors = blueprint._validateCallDAG();
      const missing = errors.find((e) => e.message.includes("missing a Function Input"));
      expect(missing).toBeDefined();
    });

    it("generateAllShaders returns null when a cycle exists", async () => {
      const { getHandler } = await import("../graph-kinds/index.js");

      const fnA = blueprint.createFunctionGraph({ name: "A" });
      const fnB = blueprint.createFunctionGraph({ name: "B" });

      fnA.data.contract = {
        inputs: [{ id: "p1", name: "x", type: "float" }],
        outputs: [{ id: "p2", name: "r", type: "float" }],
      };
      fnB.data.contract = {
        inputs: [{ id: "p3", name: "y", type: "float" }],
        outputs: [{ id: "p4", name: "s", type: "float" }],
      };
      blueprint.syncContractCallers(fnA);
      blueprint.syncContractCallers(fnB);

      // A→B and B→A (force cycle)
      const h = getHandler("function");
      blueprint.setActiveGraph(fnA.id);
      blueprint.addNode(0, 0, h.createCallerNodeType(fnB, blueprint));
      blueprint.setActiveGraph(fnB.id);
      blueprint.addNode(0, 0, h.createCallerNodeType(fnA, blueprint));

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const shaders = blueprint.generateAllShaders();
      expect(shaders).toBeNull();
    });
  });

  describe("loop body cycle prevention", () => {
    it("rejects loop body self-call", async () => {
      const { wouldCreateCycle } = await import("../graph-kinds/index.js");
      const loop = blueprint.createLoopBodyGraph({ name: "SelfLoop" });
      expect(wouldCreateCycle(blueprint, loop.id, loop.id)).toBe(true);
    });

    it("rejects cycle between function and loop body", async () => {
      const { wouldCreateCycle, getHandler } = await import("../graph-kinds/index.js");

      const fn = blueprint.createFunctionGraph({ name: "Fn" });
      const loop = blueprint.createLoopBodyGraph({ name: "Loop" });

      // Fn calls Loop (via ForLoop node)
      blueprint.setActiveGraph(fn.id);
      const loopHandler = getHandler("loopBody");
      blueprint.addNode(0, 0, loopHandler.createCallerNodeType(loop, blueprint));

      // Loop calling Fn would create a cycle
      expect(wouldCreateCycle(blueprint, loop.id, fn.id)).toBe(true);
    });
  });
});
