// Auto-arrange has to place *every* node it was given.
//
// The tree layout hangs off one root and only covers that root's backward cone,
// so for years a component with several sinks silently lost everything outside
// the chosen cone - those nodes were never assigned coordinates and just kept the
// ones they already had while the rest of the graph moved out from under them.
// Five of the shipped examples did this, always to a Set Variable, and it was the
// only source of node-on-node overlap in the whole corpus.
//
// These tests are the net. They pass `fitComments: false` throughout: the comment
// separation pass translates whole groups, which moves an unplaced node that
// happens to sit in a comment and hides exactly the bug being checked.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bootstrap, ROOT } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

const EXAMPLES = path.join(ROOT, "examples");
const EXAMPLE_FILES = fs
  .readdirSync(EXAMPLES)
  .filter((f) => f.endsWith(".c3sg"))
  .sort();

// Far enough that anything left behind is unmistakable, and no real layout
// reaches it.
const MARKER = 1e6;

const allNodes = () => [...blueprint.graphs.values()].flatMap((g) => g.nodes);
const geometry = () =>
  allNodes()
    .map((n) => `${n.id}:${n.x},${n.y}`)
    .join("|");

async function loadExample(file) {
  await api.projects.loadSaveData(
    fs.readFileSync(path.join(EXAMPLES, file), "utf-8"),
  );
}

function markEveryNode() {
  for (const node of allNodes()) {
    node.x += MARKER;
    node.y += MARKER;
  }
}

const stillMarked = () =>
  allNodes()
    .filter((n) => n.x > MARKER / 2 || n.y > MARKER / 2)
    .map((n) => `${n.title}#${n.id}`);

function overlappingPairs() {
  const found = [];
  for (const graph of blueprint.graphs.values()) {
    const ns = graph.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i];
        const b = ns[j];
        if (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        ) {
          found.push(`${a.title}#${a.id} / ${b.title}#${b.id}`);
        }
      }
    }
  }
  return found;
}

function connect(srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  blueprint.resolveGenericsForConnection(srcPort, dstPort);
  return wire;
}

describe("every node gets laid out", () => {
  it.each(EXAMPLE_FILES)("%s leaves nothing behind", async (file) => {
    await loadExample(file);
    markEveryNode();
    blueprint.autoArrangeAllGraphs({ fitComments: false });
    expect(stillMarked()).toEqual([]);
  });

  it.each(EXAMPLE_FILES)("%s has no overlapping nodes", async (file) => {
    await loadExample(file);
    blueprint.autoArrangeAllGraphs({ fitComments: false });
    expect(overlappingPairs()).toEqual([]);
  });

  it.each(EXAMPLE_FILES)("%s arranges to a fixpoint", async (file) => {
    await loadExample(file);
    blueprint.autoArrangeAllGraphs({ fitComments: false });
    const once = geometry();
    blueprint.autoArrangeAllGraphs({ fitComments: false });
    expect(geometry()).toBe(once);
  });
});

describe("multiple sinks in one component", () => {
  beforeEach(() => {
    blueprint.createNewFile();
    blueprint.setActiveGraph(blueprint.mainGraphId);
    blueprint.clearSelection();
  });

  it("lays out both Set Variables fed by one node", () => {
    // Two output ports, each to its own sink - one component, two sinks. Not a
    // fan-out, so normalizeFanoutsForLayout leaves it alone.
    const source = blueprint.addNode(2000, 2000, NODE_TYPES.vec2Decompose);
    const first = blueprint.addNode(2400, 2000, NODE_TYPES.setVariable);
    const second = blueprint.addNode(2400, 2400, NODE_TYPES.setVariable);
    first.customInput = "alpha";
    second.customInput = "beta";
    connect(source.outputPorts[0], first.inputPorts[0]);
    connect(source.outputPorts[1], second.inputPorts[0]);

    markEveryNode();
    blueprint.autoArrange({ fitComments: false });

    expect(stillMarked()).toEqual([]);
    expect(overlappingPairs()).toEqual([]);
  });

  it("parks a lone secondary sink beside its provider, not below the tree", () => {
    // A tall primary cone. Stacking the orphan as a branch would put it below all
    // of it; the satellite rule keeps it next to the node it reads.
    //
    // The split feeds its two sinks from two *different* ports on purpose: one
    // port with two targets is a fan-out, and normalizeFanoutsForLayout would
    // rewrite it into a Set/Get pair before the layout ever ran.
    //
    // Start from an empty graph: the default nodes createNewFile seeds would
    // crowd the column the satellite lands in, and the slide-down past them is
    // correct behaviour that would make the assertion below measure the fixture.
    blueprint.selectAllNodes();
    blueprint.deleteSelected();
    blueprint.clearSelection();

    let previous = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    for (let i = 0; i < 12; i++) {
      const next = blueprint.addNode(0, 0, NODE_TYPES.multiply);
      connect(previous.outputPorts[0], next.inputPorts[0]);
      previous = next;
    }
    const split = blueprint.addNode(0, 0, NODE_TYPES.vec2Decompose);
    connect(previous.outputPorts[0], split.inputPorts[0]);

    const output = blueprint.addNode(0, 0, NODE_TYPES.toVec4);
    connect(split.outputPorts[0], output.inputPorts[0]);

    const stored = blueprint.addNode(9000, 9000, NODE_TYPES.setVariable);
    stored.customInput = "stashed";
    connect(split.outputPorts[1], stored.inputPorts[0]);

    blueprint.autoArrange({ fitComments: false });

    // Immediately right of the split, in its column. A secondary branch would
    // instead be right-aligned with the primary root, a whole chain away.
    expect(stored.x).toBeGreaterThanOrEqual(split.x + split.width);
    expect(stored.x - (split.x + split.width)).toBeLessThan(200);

    // And still inside the component's vertical span. Stacking would have put it
    // branchSpacing *below* the lowest node in the graph; it may slide down past
    // the split's other consumer, but never that far.
    const othersBottom = Math.max(
      ...blueprint.nodes
        .filter((n) => n !== stored)
        .map((n) => n.y + n.height),
    );
    expect(stored.y).toBeLessThan(othersBottom);
    expect(overlappingPairs()).toEqual([]);
  });

  it("still lays out a component with no sink at all", () => {
    // A cycle reaches no sink, so it belongs to no cone. It has to fall through
    // to traditionalLayout rather than being dropped. Built by hand - the editor
    // refuses to create one.
    const a = blueprint.addNode(5000, 5000, NODE_TYPES.multiply);
    const b = blueprint.addNode(5400, 5000, NODE_TYPES.multiply);
    connect(a.outputPorts[0], b.inputPorts[0]);
    const back = new globalThis.__sgWire(b.outputPorts[0], a.inputPorts[0]);
    b.outputPorts[0].connections.push(back);
    a.inputPorts[0].connections.push(back);
    blueprint.wires.push(back);

    markEveryNode();
    blueprint.autoArrange({ fitComments: false });

    expect(stillMarked()).toEqual([]);
  });
});

describe("terminal nodes", () => {
  it("a function graph anchors on its Function Output", () => {
    blueprint.createNewFile();
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    blueprint.setActiveGraph(fn.id);

    const boundary = blueprint.nodes.find(
      (n) => n.nodeType.name === "Function Output",
    );
    expect(boundary).toBeTruthy();

    // A stray sink that would win the root election if only "Output" counted.
    const stray = blueprint.addNode(4000, 4000, NODE_TYPES.setVariable);
    stray.customInput = "stray";
    const feeder = blueprint.addNode(3600, 4000, NODE_TYPES.floatInput);
    connect(feeder.outputPorts[0], stray.inputPorts[0]);

    const subgraph = blueprint.autoLayoutEngine.buildDependencyGraph(
      blueprint.nodes,
    );
    expect(blueprint.autoLayoutEngine.findRootNode(subgraph)).toBe(boundary.id);

    // Only this graph is arranged, so only check this graph.
    for (const node of blueprint.nodes) {
      node.x += MARKER;
      node.y += MARKER;
    }
    blueprint.autoArrange({ fitComments: false });
    expect(
      blueprint.nodes
        .filter((n) => n.x > MARKER / 2 || n.y > MARKER / 2)
        .map((n) => `${n.title}#${n.id}`),
    ).toEqual([]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
  });
});
