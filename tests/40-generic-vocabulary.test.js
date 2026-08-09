// Issue #121 — "input and output types differ between functions and loop
// bodies... for some reason only loop bodies have the new generic type thing".
//
// The two kinds had grown separate copies of the type vocabulary and drifted.
// function-kind decided "generic" by asking PORT_TYPES; loop-body-kind decided
// it by string length, so:
//
//   * "genType" is longer than one character, so a loop body called it
//     CONCRETE and would emit `genType` verbatim as a GLSL type name;
//   * the loop-body editor could hand out V/W/X, which PORT_TYPES didn't
//     define — no colour, no allowed types, skipped by generic resolution.
//
// Both now read one vocabulary from graph-kinds/contract.js, and PORT_TYPES
// defines T..Z so no previously reachable letter is left dangling.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";
import { isGenericType, PORT_TYPES } from "../nodes/PortTypes.js";
import {
  GENERIC_TYPE_OPTIONS,
  CONCRETE_TYPE_OPTIONS,
  isConcreteType,
} from "../graph-kinds/contract.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

describe("ONE GENERIC VOCABULARY (#121)", () => {
  it("defines every single-letter slot the old alphabet could hand out", () => {
    for (const letter of ["T", "U", "V", "W", "X", "Y", "Z"]) {
      expect(PORT_TYPES[letter]).toBeDefined();
      expect(isGenericType(letter)).toBe(true);
      expect(PORT_TYPES[letter].allowedTypes.length).toBeGreaterThan(0);
    }
  });

  it("treats the genType family as generic, not concrete", () => {
    // The loop-body regression: length > 1 meant "concrete".
    for (const t of [
      "genType",
      "genType2OrLess",
      "genType3OrLess",
      "genType2Plus",
      "genType3Plus",
      "genIType",
      "genBType",
      "genMatType",
    ]) {
      expect(isGenericType(t)).toBe(true);
      expect(isConcreteType(t)).toBe(false);
    }
  });

  it("treats the concrete options as concrete", () => {
    for (const opt of CONCRETE_TYPE_OPTIONS) {
      expect(isConcreteType(opt.value)).toBe(true);
    }
  });

  it("offers every generic option as a real PORT_TYPES entry", () => {
    for (const opt of GENERIC_TYPE_OPTIONS) {
      expect(PORT_TYPES[opt.value]).toBeDefined();
      expect(isGenericType(opt.value)).toBe(true);
    }
  });

  describe("both kinds agree", () => {
    it("a genType accumulator makes the loop signature generic", async () => {
      const { loopBodyKindHandler } = await import(
        "../graph-kinds/loop-body-kind.js"
      );
      const g = blueprint.createLoopBodyGraph({ name: "GenLoop" });
      g.data.contract = {
        inputs: [],
        outputs: [{ id: "a1", name: "acc", type: "genType" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = blueprint.addNode(
        0,
        0,
        blueprint.getCallableFunctionNodeTypes()[`for_loop_${g.id}`],
      );
      const sig = loopBodyKindHandler.computeCallSiteSignature(
        caller,
        blueprint,
      );

      expect(sig.hasGenerics).toBe(true);
      // Never the literal type name — that was the bug.
      expect(sig.resolvedOutputTypes).not.toContain("genType");
      expect(sig.resolvedInputTypes).not.toContain("genType");
    });

    it("a V-typed accumulator resolves instead of being emitted verbatim", async () => {
      const { loopBodyKindHandler } = await import(
        "../graph-kinds/loop-body-kind.js"
      );
      const g = blueprint.createLoopBodyGraph({ name: "LetterLoop" });
      g.data.contract = {
        inputs: [],
        outputs: [{ id: "a1", name: "acc", type: "V" }],
      };
      blueprint.syncContractCallers(g);

      blueprint.setActiveGraph(blueprint.mainGraphId);
      const caller = blueprint.addNode(
        0,
        0,
        blueprint.getCallableFunctionNodeTypes()[`for_loop_${g.id}`],
      );
      const sig = loopBodyKindHandler.computeCallSiteSignature(
        caller,
        blueprint,
      );

      expect(sig.hasGenerics).toBe(true);
      expect(sig.resolvedOutputTypes).not.toContain("V");
    });

    it("both handlers reject a type the app does not know", async () => {
      const { loopBodyKindHandler } = await import(
        "../graph-kinds/loop-body-kind.js"
      );
      const { functionKindHandler } = await import(
        "../graph-kinds/function-kind.js"
      );

      const bogus = { inputs: [], outputs: [{ id: "a", name: "x", type: "Q" }] };
      expect(
        loopBodyKindHandler.validateContract(bogus).some((e) => e.includes("Q")),
      ).toBe(true);
      expect(
        functionKindHandler.validateContract(bogus).some((e) => e.includes("Q")),
      ).toBe(true);
    });
  });
});
