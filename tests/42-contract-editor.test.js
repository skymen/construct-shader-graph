// One contract editor for both graph kinds.
//
// There used to be a near-identical copy in function-kind.js and
// loop-body-kind.js. They drifted (see tests/40 for what that cost), and the
// function copy's inline duplicate-name check disagreed with its own
// validateContract — so you could type a name the editor accepted and codegen
// then rejected with no visible message (#120).
//
// The editor now runs the handler's real validator to decide what to accept,
// which is what makes the two agree by construction.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function containers() {
  return {
    infoForm: document.getElementById("function-info-form"),
    inputsList: document.getElementById("function-inputs-list"),
    outputsList: document.getElementById("function-outputs-list"),
  };
}

function renderFor(graph) {
  blueprint.setActiveGraph(graph.id);
  blueprint.renderContractEditor();
  return containers();
}

describe("SHARED CONTRACT EDITOR", () => {
  it("renders rows for both kinds through the same builder", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    let c = renderFor(fn);
    const fnRow = c.inputsList.querySelector(".contract-port-row");
    expect(fnRow).toBeTruthy();
    expect(fnRow.querySelector(".contract-port-name")).toBeTruthy();
    expect(fnRow.querySelector(".contract-port-type")).toBeTruthy();
    expect(fnRow.querySelector(".contract-port-delete")).toBeTruthy();

    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    c = renderFor(loop);
    const loopRow = c.outputsList.querySelector(".contract-port-row");
    expect(loopRow).toBeTruthy();
    // Same row anatomy — and, unlike before, the delete button is real.
    expect(loopRow.querySelector(".contract-port-name")).toBeTruthy();
    expect(loopRow.querySelector(".contract-port-type")).toBeTruthy();
    expect(loopRow.querySelector(".contract-port-delete").disabled).toBe(false);
  });

  it("offers the same type options to both kinds", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    const fnOpts = [
      ...renderFor(fn)
        .inputsList.querySelector(".contract-port-type")
        .querySelectorAll("option"),
    ].map((o) => o.value);

    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    const loopOpts = [
      ...renderFor(loop)
        .outputsList.querySelector(".contract-port-type")
        .querySelectorAll("option"),
    ].map((o) => o.value);

    expect(loopOpts).toEqual(fnOpts);
    expect(loopOpts).toContain("genType");
  });

  it("names a loop body's sections for what they hold", () => {
    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    renderFor(loop);
    expect(
      document.querySelector("#function-outputs-section h2").textContent,
    ).toBe("Accumulators");
    expect(
      document.querySelector("#function-inputs-section h2").textContent,
    ).toBe("Arguments");

    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    renderFor(fn);
    expect(
      document.querySelector("#function-outputs-section h2").textContent,
    ).toBe("Outputs");
  });

  it("does not mutate the contract just by rendering", () => {
    // renderPortList used to do `contract[which] ||= []`, so opening the
    // sidebar wrote onto the graph — which then got serialized into the file
    // and snapshotted into history.
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    const before = JSON.stringify(fn.data.contract);
    renderFor(fn);
    renderFor(fn);
    expect(JSON.stringify(fn.data.contract)).toBe(before);

    const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
    const loopBefore = JSON.stringify(loop.data.contract);
    renderFor(loop);
    expect(JSON.stringify(loop.data.contract)).toBe(loopBefore);
  });

  it("survives a contract with a missing side", () => {
    // Reachable through the console API and from a truncated file. It should
    // render empty, not throw.
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    fn.data.contract = { inputs: [{ id: "a", name: "x", type: "float" }] };
    expect(() => renderFor(fn)).not.toThrow();
    expect(
      containers().inputsList.querySelectorAll(".contract-port-row"),
    ).toHaveLength(1);
  });

  describe("name validation matches the validator (#120)", () => {
    it("a function accepts an input and an output sharing a name", () => {
      const fn = blueprint.createFunctionGraph({ name: "Fn" });
      fn.data.contract = {
        inputs: [{ id: "i1", name: "value", type: "float" }],
        outputs: [{ id: "o1", name: "result", type: "float" }],
      };
      const c = renderFor(fn);

      const outName = c.outputsList.querySelector(".contract-port-name");
      outName.value = "value";
      outName.dispatchEvent(new window.Event("change"));

      // Emitted params are prefixed in_/out_, so this is safe — and the
      // validator agrees, which is the point.
      expect(fn.data.contract.outputs[0].name).toBe("value");
    });

    it("a function still rejects two inputs sharing a name", () => {
      const fn = blueprint.createFunctionGraph({ name: "Fn" });
      fn.data.contract = {
        inputs: [
          { id: "i1", name: "a", type: "float" },
          { id: "i2", name: "b", type: "float" },
        ],
        outputs: [{ id: "o1", name: "r", type: "float" }],
      };
      const c = renderFor(fn);

      const second = c.inputsList.querySelectorAll(".contract-port-name")[1];
      second.value = "a";
      second.dispatchEvent(new window.Event("change"));

      expect(fn.data.contract.inputs[1].name).toBe("b"); // reverted
      expect(second.value).toBe("b");
    });

    it("a loop rejects an argument colliding with an accumulator", () => {
      const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
      loop.data.contract = {
        inputs: [{ id: "s1", name: "step", type: "float" }],
        outputs: [{ id: "a1", name: "sum", type: "float" }],
      };
      const c = renderFor(loop);

      const argName = c.inputsList.querySelector(".contract-port-name");
      argName.value = "sum";
      argName.dispatchEvent(new window.Event("change"));

      // Both become body input params, so this one really would collide.
      expect(loop.data.contract.inputs[0].name).toBe("step"); // reverted
    });
  });

  describe("adding and deleting ports (#122)", () => {
    it("+ Add Output on a loop body creates a usable accumulator", () => {
      const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
      renderFor(loop);
      const before = loop.data.contract.outputs.length;

      blueprint._addContractPort("outputs");

      expect(loop.data.contract.outputs).toHaveLength(before + 1);
      // No orphan states are expressible, so the contract stays valid.
      expect(loop.data.contract.outputs.every((p) => p.role)).toBe(false);
    });

    it("+ Add Input on a loop body creates an argument", () => {
      const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
      renderFor(loop);

      blueprint._addContractPort("inputs");

      expect(loop.data.contract.inputs).toHaveLength(1);
      expect(loop.data.contract.outputs).toHaveLength(1); // unchanged
    });

    it("deleting an accumulator row removes it", () => {
      const loop = blueprint.createLoopBodyGraph({ name: "Loop" });
      loop.data.contract = {
        inputs: [],
        outputs: [
          { id: "a1", name: "sum", type: "float" },
          { id: "a2", name: "prod", type: "float" },
        ],
      };
      const c = renderFor(loop);

      c.outputsList
        .querySelectorAll(".contract-port-delete")[0]
        .dispatchEvent(new window.Event("click"));

      expect(loop.data.contract.outputs).toHaveLength(1);
      expect(loop.data.contract.outputs[0].name).toBe("prod");
    });
  });
});
