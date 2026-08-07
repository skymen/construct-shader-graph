// Issue #120 (first half) — "If code gen fails bc of function, say it more
// clearly".
//
// _validateCallDAG() already knows exactly what is wrong and which graph it is
// in. _generateAllShadersImpl() used to console.warn that and return null, so
// every consumer fell back to guessing: the preview said "Make sure you have an
// Output node and all required connections are made", and View Code and Export
// both alert()ed "No output node found" — regardless of the real cause.
//
// The reason is now kept on the host as lastCodegenErrors and read back through
// codegenFailureMessage(). generateAllShaders() still returns null-or-result,
// so no existing caller changes.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// A main graph that compiles on its own, so the only thing that can fail is
// whatever the individual test breaks.
function setupWorkingMain() {
  blueprint.setActiveGraph(blueprint.mainGraphId);
  blueprint.addNode(400, 200, NODE_TYPES.output);
}

describe("CODEGEN FAILURE REPORTING (#120)", () => {
  it("leaves no errors behind when generation succeeds", () => {
    setupWorkingMain();
    const shaders = blueprint.generateAllShaders();

    expect(shaders).toBeTruthy();
    expect(blueprint.lastCodegenErrors).toEqual([]);
  });

  it("names the function whose contract is broken", () => {
    setupWorkingMain();
    const fn = blueprint.createFunctionGraph({ name: "Blur" });
    // Duplicate port name — validateContract rejects this.
    fn.data.contract = {
      inputs: [
        { id: "a", name: "value", type: "float" },
        { id: "b", name: "value", type: "float" },
      ],
      outputs: [{ id: "c", name: "result", type: "float" }],
    };

    const shaders = blueprint.generateAllShaders();
    expect(shaders).toBeNull();

    const msg = blueprint.codegenFailureMessage();
    expect(msg).toContain("Blur");
    expect(msg).toContain("value");
    // The old, wrong explanation must be gone.
    expect(msg).not.toContain("Output node");
  });

  it("names the graph missing a Function Output node", () => {
    setupWorkingMain();
    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    const outputNode = fn.nodes.find(
      (n) => n.nodeType.name === "Function Output",
    );
    fn.nodes = fn.nodes.filter((n) => n !== outputNode);

    expect(blueprint.generateAllShaders()).toBeNull();
    const msg = blueprint.codegenFailureMessage();
    expect(msg).toContain("Helper");
    expect(msg).toContain("Function Output");
  });

  it("still says so when the main graph really has no Output node", () => {
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const main = blueprint.mainGraph;
    main.nodes = main.nodes.filter((n) => n.nodeType !== NODE_TYPES.output);

    expect(blueprint.generateAllShaders()).toBeNull();
    expect(blueprint.codegenFailureMessage()).toContain("Output node");
  });

  it("falls back to the generic wording before codegen has ever run", () => {
    blueprint.lastCodegenErrors = [];
    expect(blueprint.codegenFailureMessage()).toContain("Output node");
  });

  it("surfaces the same reason through the console API", () => {
    setupWorkingMain();
    const fn = blueprint.createFunctionGraph({ name: "Blur" });
    fn.data.contract = {
      inputs: [
        { id: "a", name: "value", type: "float" },
        { id: "b", name: "value", type: "float" },
      ],
      outputs: [{ id: "c", name: "result", type: "float" }],
    };

    const result = api.graph.validate();
    expect(result.ok).toBe(false);
    const text = result.errors.map((e) => e.message).join("\n");
    expect(text).toContain("Blur");
    expect(text).not.toContain(
      "Make sure the graph has an Output node and valid connections",
    );
  });
});
