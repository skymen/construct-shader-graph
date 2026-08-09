// Comments follow their nodes through a layout pass (issue #95).
//
// Membership is geometric everywhere in this app — a comment owns whatever sits
// inside it right now — so auto-arrange snapshots that before moving anything and
// refits the boxes afterwards. The invariants worth pinning are: no captured
// member is lost, the author's per-side padding survives, an arrange is a
// fixpoint, and the whole thing is one undo entry.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, api, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, api, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  blueprint.setActiveGraph(blueprint.mainGraphId);
  blueprint.clearSelection();
  blueprint.history.clear();
});

// Coalescing merges two pushes made within a second of each other, which is
// right for the editor and wrong for a test counting entries.
function defeatCoalescing() {
  blueprint.history.lastChangeTime = 0;
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

const rect = (c) => ({ x: c.x, y: c.y, width: c.width, height: c.height });
const bounds = (nodes) => ({
  minX: Math.min(...nodes.map((n) => n.x)),
  minY: Math.min(...nodes.map((n) => n.y)),
  maxX: Math.max(...nodes.map((n) => n.x + n.width)),
  maxY: Math.max(...nodes.map((n) => n.y + n.height)),
});
const rects = () => blueprint.comments.map(rect);
const nodePositions = () => blueprint.nodes.map((n) => ({ x: n.x, y: n.y }));

// A little chain of real nodes, far from whatever createNewFile seeded, so the
// layout actually has something of its own to move.
function chain(x = 2000, y = 2000) {
  const a = blueprint.addNode(x, y, NODE_TYPES.floatInput);
  const b = blueprint.addNode(x + 400, y, NODE_TYPES.toVec4);
  connect(a.outputPorts[0], b.inputPorts[0]);
  return [a, b];
}

describe("auto-arrange keeps comments around their nodes", () => {
  it("every captured member is still inside the comment afterwards", () => {
    const nodes = chain();
    const comment = blueprint.createCommentAroundNodes(nodes);

    blueprint.autoArrange();

    for (const node of nodes) {
      expect(comment.containsNode(node)).toBe(true);
    }
  });

  it("refits snug at the standard padding, dropping hand-dragged slack", () => {
    const nodes = chain();
    const comment = blueprint.createCommentAroundNodes(nodes, { padding: 10 });
    // Slack an author might have dragged in. The refit is not supposed to carry
    // it around.
    comment.width += 500;
    comment.height += 500;

    blueprint.autoArrange();

    const box = bounds(nodes);
    expect(box.minX - comment.x).toBeCloseTo(30, 6);
    expect(comment.x + comment.width - box.maxX).toBeCloseTo(30, 6);
    expect(comment.y + comment.height - box.maxY).toBeCloseTo(30, 6);
    // The title bar is drawn inside the rect, so the top gap is the padding plus
    // room for it.
    expect(box.minY - comment.y).toBeCloseTo(30 + 31, 6);
  });

  it("leaves room above the nodes for a wrapped description", () => {
    const short = chain(2000, 2000);
    const long = chain(2000, 6000);
    const a = blueprint.createCommentAroundNodes(short, {
      description: "one line",
    });
    const b = blueprint.createCommentAroundNodes(long, {
      description: Array.from(
        { length: 12 },
        (_, i) => `paragraph number ${i} of the description`,
      ).join("\n"),
    });

    blueprint.autoArrange();

    const topGap = (comment, nodes) => bounds(nodes).minY - comment.y;
    // Both clear the title bar, and each extra line of description buys exactly
    // one more line height of room.
    expect(topGap(a, short)).toBeGreaterThan(31);
    const extraLines =
      blueprint.wrapCommentDescription(b.description, b.width).length - 1;
    expect(extraLines).toBeGreaterThanOrEqual(11);
    expect(topGap(b, long)).toBeCloseTo(topGap(a, short) + extraLines * 16, 6);

    // The reserved band has to actually hold every line the renderer will draw.
    for (const [comment, nodes] of [
      [a, short],
      [b, long],
    ]) {
      const lines = blueprint.wrapCommentDescription(
        comment.description,
        comment.width,
      );
      const lastBaseline = comment.y + 50 + (lines.length - 1) * 16;
      expect(lastBaseline).toBeLessThan(bounds(nodes).minY);
    }
  });

  it("sizes a comment the same way whether it is created or refitted", () => {
    const nodes = chain();
    const created = blueprint.createCommentAroundNodes(nodes, {
      description: "a description long enough to matter\nsecond paragraph",
    });
    const asCreated = rect(created);

    // Shift the nodes so the refit has something to react to, then check it
    // lands on exactly the box creation would have produced there.
    const snapshot = blueprint.captureCommentMembership();
    nodes.forEach((n) => {
      n.x += 137;
      n.y += 251;
    });
    blueprint.refitCommentsToMembership(snapshot, { separate: false });

    expect(rect(created)).toEqual({
      x: asCreated.x + 137,
      y: asCreated.y + 251,
      width: asCreated.width,
      height: asCreated.height,
    });
  });

  it("is a fixpoint: arranging twice changes nothing the second time", () => {
    chain();
    const [c, d] = chain(2000, 3000);
    blueprint.createCommentAroundNodes([c, d]);

    blueprint.autoArrange();
    const nodesAfterFirst = nodePositions();
    const commentsAfterFirst = rects();

    blueprint.autoArrange();

    expect(nodePositions()).toEqual(nodesAfterFirst);
    expect(rects()).toEqual(commentsAfterFirst);
  });

  it("a second arrange records no undo entry (no float noise in the refit)", () => {
    const nodes = chain();
    blueprint.createCommentAroundNodes(nodes);

    blueprint.autoArrange();
    defeatCoalescing();
    const entries = blueprint.history.undoStack.length;

    blueprint.autoArrange();

    expect(blueprint.history.undoStack.length).toBe(entries);
  });

  it("node moves and the comment refit land in one undo entry", () => {
    const nodes = chain();
    const comment = blueprint.createCommentAroundNodes(nodes);
    defeatCoalescing();

    const before = rect(comment);
    const nodesBefore = nodePositions();
    const entries = blueprint.history.undoStack.length;

    blueprint.autoArrange();

    expect(blueprint.history.undoStack.length).toBe(entries + 1);
    expect(rect(comment)).not.toEqual(before);

    blueprint.history.undo();

    expect(rect(blueprint.comments[0])).toEqual(before);
    expect(nodePositions()).toEqual(nodesBefore);
  });

  it("rides along in the caller's entry when recordHistory is suppressed", () => {
    // deleteDanglingNodes arranges with recordHistory:false and pushes one entry
    // of its own. The refit has to happen before that push, not after.
    const nodes = chain();
    const orphan = blueprint.addNode(2000, 4000, NODE_TYPES.floatInput);
    const comment = blueprint.createCommentAroundNodes(nodes);
    defeatCoalescing();

    const before = rect(comment);
    const entries = blueprint.history.undoStack.length;

    const result = blueprint.deleteDanglingNodes({ autoLayout: true });
    expect(result.deletedNodeIds).toContain(orphan.id);

    expect(blueprint.history.undoStack.length).toBe(entries + 1);

    blueprint.history.undo();
    expect(rect(blueprint.comments[0])).toEqual(before);
  });

  it("keeps a nested comment inside its parent", () => {
    const inner = chain(2000, 2000);
    const outerOnly = chain(2000, 3000);
    const innerComment = blueprint.createCommentAroundNodes(inner);
    const outerComment = blueprint.createCommentAroundNodes([
      ...inner,
      ...outerOnly,
      // Reach around the inner comment's own box, not just its nodes.
      { x: innerComment.x, y: innerComment.y, width: innerComment.width, height: innerComment.height },
    ]);
    expect(outerComment.containsComment(innerComment)).toBe(true);

    blueprint.autoArrange();

    expect(outerComment.containsComment(innerComment)).toBe(true);
    for (const node of inner) {
      expect(innerComment.containsNode(node)).toBe(true);
      expect(outerComment.containsNode(node)).toBe(true);
    }
    for (const node of outerOnly) {
      expect(outerComment.containsNode(node)).toBe(true);
    }
  });

  it("leaves no overlap at all between comments after an arrange", () => {
    // Five chains whose comments all start stacked on the same spot.
    const groups = [];
    for (let i = 0; i < 5; i++) {
      const nodes = chain(2000, 2000 + i * 900);
      groups.push({ nodes, comment: blueprint.createCommentAroundNodes(nodes) });
    }

    blueprint.autoArrange();

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        expect(
          blueprint.commentOverlapFraction(
            groups[i].comment,
            groups[j].comment,
          ),
        ).toBe(0);
      }
      for (const node of groups[i].nodes) {
        expect(groups[i].comment.containsNode(node)).toBe(true);
      }
    }
  });

  it("an empty comment is solid: it pushes, but is not pushed", () => {
    const nodes = chain(2000, 2000);
    const comment = blueprint.createCommentAroundNodes(nodes);
    // A standalone note the author parked deliberately, right where the arranged
    // graph is going to land.
    const note = blueprint.createCommentAroundNodes([
      { x: -600, y: -400, width: 400, height: 300 },
    ]);
    const parked = rect(note);

    blueprint.autoArrange();

    expect(rect(note)).toEqual(parked);
    expect(blueprint.commentOverlapFraction(comment, note)).toBe(0);
    for (const node of nodes) expect(comment.containsNode(node)).toBe(true);
  });

  it("pushes apart two comments that end up piled on each other", () => {
    const upper = chain(2000, 2000);
    const lower = chain(2000, 4000);
    const a = blueprint.createCommentAroundNodes(upper);
    const b = blueprint.createCommentAroundNodes(lower);

    // Stretch each box towards the other so they overlap heavily while each
    // still holds only its own nodes. The refit preserves that padding, so the
    // overlap survives into the separation pass.
    // Stop each stretch short of the other's node centres, which is what
    // decides membership.
    a.height = 3900 - a.y;
    b.height += b.y - 2200;
    b.y = 2200;

    for (const node of lower) expect(a.containsNode(node)).toBe(false);
    for (const node of upper) expect(b.containsNode(node)).toBe(false);
    expect(blueprint.commentOverlapFraction(a, b)).toBeGreaterThan(0.25);

    blueprint.autoArrange();

    expect(blueprint.commentOverlapFraction(a, b)).toBe(0);
    for (const node of upper) expect(a.containsNode(node)).toBe(true);
    for (const node of lower) expect(b.containsNode(node)).toBe(true);
  });

  it("leaves two comments sharing a node alone", () => {
    // No rigid translation can pull apart two boxes that must both keep
    // enclosing the same node, so the pair is skipped and `csg lint` keeps
    // reporting it.
    const nodes = chain();
    const a = blueprint.createCommentAroundNodes(nodes);
    const b = blueprint.createCommentAroundNodes(nodes, { padding: 45 });
    expect(blueprint.commentOverlapFraction(a, b)).toBeGreaterThan(0.25);

    blueprint.autoArrange();

    expect(blueprint.commentOverlapFraction(a, b)).toBeGreaterThan(0.25);
    const audit = api.graph.audit();
    expect(
      audit.issues.some(
        (issue) =>
          issue.kind === "multiCommentedNode" &&
          nodes.some((n) => n.id === issue.nodeId),
      ),
    ).toBe(true);
  });

  it("leaves an empty comment exactly where it is", () => {
    chain();
    // Somewhere the layout will not reach.
    const empty = blueprint.createCommentAroundNodes([
      { x: -9000, y: -9000, width: 200, height: 120 },
    ]);
    const before = rect(empty);

    blueprint.autoArrange();

    expect(rect(empty)).toEqual(before);
  });

  it("refits comments in graphs that are not the active one", () => {
    const fn = blueprint.createFunctionGraph({ name: "Fn" });
    let comment, nodes;
    blueprint.setActiveGraph(fn.id);
    nodes = chain();
    comment = blueprint.createCommentAroundNodes(nodes);
    blueprint.setActiveGraph(blueprint.mainGraphId);

    const before = rect(comment);
    blueprint.autoArrangeAllGraphs();

    expect(rect(comment)).not.toEqual(before);
    blueprint.setActiveGraph(fn.id);
    for (const node of nodes) expect(comment.containsNode(node)).toBe(true);
    blueprint.setActiveGraph(blueprint.mainGraphId);
  });

  it("leaves comments untouched whose members a selection arrange did not move", () => {
    const moved = chain(2000, 2000);
    const untouched = chain(2000, 5000);
    const movedComment = blueprint.createCommentAroundNodes(moved);
    const untouchedComment = blueprint.createCommentAroundNodes(untouched);

    const stayPut = rect(untouchedComment);
    const movedBefore = rect(movedComment);

    blueprint.clearSelection();
    moved.forEach((n) => blueprint.selectNode(n, true));
    blueprint.autoArrange();

    expect(rect(untouchedComment)).toEqual(stayPut);
    expect(rect(movedComment)).not.toEqual(movedBefore);
    for (const node of moved) expect(movedComment.containsNode(node)).toBe(true);
  });

  it("fitComments:false leaves every comment rect alone", () => {
    const nodes = chain();
    blueprint.createCommentAroundNodes(nodes);
    const before = rects();
    const nodesBefore = nodePositions();

    blueprint.autoArrange({ fitComments: false });

    expect(rects()).toEqual(before);
    expect(nodePositions()).not.toEqual(nodesBefore);
  });
});

// Auto-arrange stands each comment in for the section it encloses and lays that
// section out as one block, so the box comes out tight instead of stretching to
// reach halves the packer scattered.
describe("comments are laid out as one block", () => {
  // The default nodes sit near the origin and would be caught by a comment fitted
  // around anything placed there, which is the geometric-membership hazard rather
  // than the thing under test.
  const clearSeededNodes = () => {
    for (const node of blueprint.nodes) {
      node.x = -8000;
      node.y = -8000;
    }
  };

  it("keeps two disconnected sections together in a tight box", () => {
    clearSeededNodes();
    const upper = chain(0, 0);
    const lower = chain(0, 900);
    const members = [...upper, ...lower];
    const comment = blueprint.createCommentAroundNodes(members, {
      title: "Both halves",
    });
    const before = rect(comment);

    blueprint.autoArrange();

    // One cluster formed, covering both halves.
    expect(blueprint.autoLayoutEngine.clusters.size).toBe(1);

    // Tighter than it was, and holding exactly its own nodes - no strangers.
    expect(rect(comment).height).toBeLessThan(before.height);
    expect(blueprint.nodes.filter((n) => comment.containsNode(n)).sort()).toEqual(
      members.sort(),
    );

    // The two halves end up adjacent rather than packed across the canvas.
    expect(bounds(upper).minX).toBeCloseTo(bounds(lower).minX, 6);
    const gap = bounds(lower).minY - bounds(upper).maxY;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(200);
  });

  it("survives a second arrange", () => {
    clearSeededNodes();
    const members = [...chain(0, 0), ...chain(0, 900)];
    blueprint.createCommentAroundNodes(members, { title: "Both halves" });

    blueprint.autoArrange();
    const nodesOnce = nodePositions();
    const rectsOnce = rects();

    blueprint.autoArrange();

    expect(nodePositions()).toEqual(nodesOnce);
    expect(rects()).toEqual(rectsOnce);
  });

  it("does not contract when fitComments is off", () => {
    clearSeededNodes();
    const members = [...chain(0, 0), ...chain(0, 900)];
    blueprint.createCommentAroundNodes(members, { title: "Both halves" });

    blueprint.autoArrange({ fitComments: false });

    expect(blueprint.autoLayoutEngine.clusters.size).toBe(0);
  });

  it("leaves a non-convex comment uncontracted and reports it", () => {
    clearSeededNodes();
    // A -> B -> C with only A and C in the comment. B has to be drawn between
    // them, so no layout can keep the box off it.
    // b sits well below the line a-c so a box fitted around the two ends misses
    // it: the grouping really is "the two ends but not the middle".
    const a = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const b = blueprint.addNode(400, 900, NODE_TYPES.multiply);
    const c = blueprint.addNode(800, 0, NODE_TYPES.toVec4);
    connect(a.outputPorts[0], b.inputPorts[0]);
    connect(b.outputPorts[0], c.inputPorts[0]);

    const comment = blueprint.createCommentAroundNodes([a, c], { title: "Ends" });
    expect(comment.containsNode(a)).toBe(true);
    expect(comment.containsNode(c)).toBe(true);
    expect(comment.containsNode(b)).toBe(false);

    // Reported before the arrange: the refit afterwards fits the box around a
    // and c, which spans b again, so the shape only exists in the authored state.
    const audit = api.graph.audit();
    expect(
      audit.issues.some(
        (issue) =>
          issue.kind === "nonConvexComment" && issue.commentId === comment.id,
      ),
    ).toBe(true);

    blueprint.autoArrange();
    expect(blueprint.autoLayoutEngine.clusters.size).toBe(0);
  });

  it("does not contract comments that share a node with an unrelated comment", () => {
    // Two boxes over the same node cannot both be laid out as a block, and
    // contracting them would make each arrange see a different grouping than the
    // last one produced. Nesting is fine - these two only partly overlap.
    clearSeededNodes();
    const first = blueprint.addNode(0, 0, NODE_TYPES.floatInput);
    const middle = blueprint.addNode(400, 0, NODE_TYPES.multiply);
    const last = blueprint.addNode(800, 0, NODE_TYPES.toVec4);
    connect(first.outputPorts[0], middle.inputPorts[0]);
    connect(middle.outputPorts[0], last.inputPorts[0]);

    const one = blueprint.createCommentAroundNodes([first, middle], {
      title: "One",
    });
    const two = blueprint.createCommentAroundNodes([middle, last], {
      title: "Two",
    });
    expect(one.containsComment(two)).toBe(false);
    expect(two.containsComment(one)).toBe(false);
    expect(one.containsNode(middle) && two.containsNode(middle)).toBe(true);

    blueprint.autoArrange();

    expect(blueprint.autoLayoutEngine.clusters.size).toBe(0);
  });

  it("keeps a nested comment nested and both boxes tight", () => {
    clearSeededNodes();
    const inner = chain(0, 0);
    const outer = chain(0, 900);
    const innerComment = blueprint.createCommentAroundNodes(inner, {
      title: "Inner",
    });
    const outerComment = blueprint.createCommentAroundNodes(
      [
        ...inner,
        ...outer,
        {
          x: innerComment.x,
          y: innerComment.y,
          width: innerComment.width,
          height: innerComment.height,
        },
      ],
      { title: "Outer" },
    );

    blueprint.autoArrange();

    expect(outerComment.containsComment(innerComment)).toBe(true);
    for (const node of inner) expect(innerComment.containsNode(node)).toBe(true);
    for (const node of [...inner, ...outer]) {
      expect(outerComment.containsNode(node)).toBe(true);
    }
  });
});

describe("tidyVariables keeps comments around their nodes", () => {
  it("a Set Variable that moves takes its comment with it", () => {
    const source = blueprint.addNode(2000, 2000, NODE_TYPES.floatInput);
    const setVar = blueprint.addNode(2000, 4000, NODE_TYPES.setVariable);
    connect(source.outputPorts[0], setVar.inputPorts[0]);
    const comment = blueprint.createCommentAroundNodes([setVar]);
    defeatCoalescing();

    const entries = blueprint.history.undoStack.length;
    const result = blueprint.snapVariableNodesToSources();

    expect(result.moved).toBeGreaterThan(0);
    expect(comment.containsNode(setVar)).toBe(true);
    expect(blueprint.history.undoStack.length).toBe(entries + 1);
  });
});
