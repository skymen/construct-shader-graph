// Issue #124 — "Selection before changing graph moves when coming back".
//
// Repro: select some nodes in graph A, click a function node's "open graph"
// pencil, come back to A, move the mouse — the whole selection jumps to the
// cursor.
//
// Why: the pencil sits inside the node header, so the mousedown that arms the
// button ALSO starts a drag (draggedNode set, a dragOffset recorded on every
// selected node). onMouseUp then switched graph mid-handler without returning,
// so the drag cleanup below it ran against the *new* graph. Graph A was left
// believing a drag was in progress, and since the handlers are on `document`
// and onMouseMove never checked whether a button was held, the next move
// applied those stale offsets.
//
// The fix is _cancelActiveInteraction(graph), called when the active graph
// changes and when a button click takes the pointer off the canvas.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

// Put a node down and fake the state onMouseDown would have left behind after
// grabbing it by the header at (px, py).
function startDragging(node, px, py) {
  blueprint.selectNode(node, false);
  blueprint.draggedNode = node;
  node.isDragging = true;
  node.dragOffsetX = px - node.x;
  node.dragOffsetY = py - node.y;
  blueprint.dragStartPositions.clear();
  blueprint.dragStartPositions.set(node.id, { x: node.x, y: node.y });
}

describe("INTERACTION STATE ACROSS GRAPH SWITCHES (#124)", () => {
  it("clears drag state on the graph being left", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.FloatInputNode);
    startDragging(node, 110, 110);

    const main = blueprint.mainGraph;
    expect(main.draggedNode).toBe(node);

    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    blueprint.setActiveGraph(fn.id);

    expect(main.draggedNode).toBeNull();
    expect(main.dragStartPositions.size).toBe(0);
    expect(node.isDragging).toBe(false);
  });

  it("does not move the selection when you come back and move the mouse", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.FloatInputNode);
    startDragging(node, 110, 110);

    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    blueprint.setActiveGraph(fn.id);
    blueprint.setActiveGraph(blueprint.mainGraphId);

    // A mousemove far from where the drag started. Before the fix this snapped
    // the node to the cursor via its stale dragOffset.
    blueprint.onMouseMove({ clientX: 900, clientY: 700, buttons: 0 });

    expect(node.x).toBe(100);
    expect(node.y).toBe(100);
  });

  it("clears box-select, active wire and pan state too", () => {
    const main = blueprint.mainGraph;
    main.isBoxSelecting = true;
    main.boxSelectStart = { x: 0, y: 0 };
    main.boxSelectEnd = { x: 50, y: 50 };
    main.activeWire = { fake: true };
    main.isPanning = true;

    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    blueprint.setActiveGraph(fn.id);

    expect(main.isBoxSelecting).toBe(false);
    expect(main.boxSelectStart).toBeNull();
    expect(main.boxSelectEnd).toBeNull();
    expect(main.activeWire).toBeNull();
    expect(main.isPanning).toBe(false);
  });

  it("drops a drag whose mouseup never arrived", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.FloatInputNode);
    startDragging(node, 110, 110);

    // No button held: the mouseup went to a modal / devtools / another window.
    blueprint.onMouseMove({ clientX: 900, clientY: 700, buttons: 0 });

    expect(blueprint.draggedNode).toBeNull();
    expect(node.x).toBe(100);
    expect(node.y).toBe(100);
  });

  it("still drags normally while a button IS held", () => {
    const node = blueprint.addNode(100, 100, NODE_TYPES.FloatInputNode);
    startDragging(node, 100, 100);

    blueprint.onMouseMove({ clientX: 300, clientY: 300, buttons: 1 });

    expect(blueprint.draggedNode).toBe(node);
    expect(node.x !== 100 || node.y !== 100).toBe(true);
  });

  it("the openGraph pencil switches graph and leaves the origin clean", () => {
    // The real repro path: mousedown on the pencil arms pendingButtonClick AND
    // starts a drag, then mouseup dispatches the switch.
    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    const caller = blueprint.addNode(
      200,
      200,
      blueprint.getNodeTypeFromKey(`function_call_${fn.id}`),
    );

    const main = blueprint.mainGraph;
    const evt = { clientX: 210, clientY: 210, buttons: 0 };
    const worldPos = blueprint.getMousePos(evt);

    startDragging(caller, worldPos.x, worldPos.y);
    // Mouseup lands where the mousedown was, so it counts as a click, not a drag.
    blueprint.lastClickPos = { x: worldPos.x, y: worldPos.y };
    blueprint.pendingButtonClick = { type: "openGraph", node: caller };

    blueprint.onMouseUp(evt);

    expect(blueprint.activeGraphId).toBe(fn.id);
    expect(main.draggedNode).toBeNull();
    expect(main.dragStartPositions.size).toBe(0);
    expect(caller.isDragging).toBe(false);
  });

  it("Graph declares the delegated button fields", () => {
    const fn = blueprint.createFunctionGraph({ name: "Helper" });
    expect(
      Object.prototype.hasOwnProperty.call(fn, "pendingButtonClick"),
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(fn, "hoveredNodeButton"),
    ).toBe(true);
  });
});
