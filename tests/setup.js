// Vitest setup: stub browser APIs jsdom doesn't ship.
// Runs once per test file before any imports execute.

import { vi, afterEach, expect } from "vitest";

// --- Canvas 2D context stub ---------------------------------------------------
// jsdom returns null from canvas.getContext('2d'). The BlueprintSystem renders
// during setupCanvas() in the constructor, so we need a working-enough stub.
function makeCtx2D() {
  const noop = () => {};
  const ctx = {
    canvas: null,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    direction: "inherit",
    imageSmoothingEnabled: true,
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    setLineDash: noop,
    getLineDash: () => [],
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    arcTo: noop,
    rect: noop,
    roundRect: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({
      width: 50,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 50,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    }),
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    transform: noop,
    setTransform: noop,
    resetTransform: noop,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createConicGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    drawImage: noop,
    putImageData: noop,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: (w, h) => ({
      data: new Uint8ClampedArray((w || 1) * (h || 1) * 4),
      width: w || 1,
      height: h || 1,
    }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
  return ctx;
}

const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
  if (type === "2d") {
    const ctx = makeCtx2D();
    ctx.canvas = this;
    return ctx;
  }
  return origGetContext ? origGetContext.call(this, type, ...rest) : null;
};
HTMLCanvasElement.prototype.toDataURL = function () {
  return "data:image/png;base64,";
};
HTMLCanvasElement.prototype.toBlob = function (cb) {
  cb(new Blob([], { type: "image/png" }));
};

// --- RAF / IDB / WebSocket stubs ---------------------------------------------
if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;

// IndexedDB: noop stub (recent files only; not exercised in tests)
if (typeof window.indexedDB === "undefined") {
  const req = () => {
    const r = { onsuccess: null, onerror: null, onupgradeneeded: null, result: null };
    setTimeout(() => r.onerror && r.onerror({ target: r }), 0);
    return r;
  };
  window.indexedDB = { open: req, deleteDatabase: req };
  globalThis.indexedDB = window.indexedDB;
}

// WebSocket: stub so MCP bridge doesn't try a real connection on construct
class FakeWS {
  constructor() {
    this.readyState = 0;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  addEventListener() {}
  removeEventListener() {}
}
FakeWS.CONNECTING = 0;
FakeWS.OPEN = 1;
FakeWS.CLOSING = 2;
FakeWS.CLOSED = 3;
if (typeof window.WebSocket === "undefined") {
  window.WebSocket = FakeWS;
  globalThis.WebSocket = FakeWS;
}

// matchMedia
if (typeof window.matchMedia !== "function") {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// File System Access API not present in jsdom: leave undefined; saveToJSON path
// using showSaveFilePicker is gated; tests will use exportState/loadState directly.

// devicePixelRatio
if (!("devicePixelRatio" in window)) {
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
}

// Silence noisy logs during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  const noop = () => {};
  // Keep error/warn but mute log/info/debug
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

// --- Phantom-wire invariant check --------------------------------------------
// After every test, walk the blueprint's graphs and assert wire/port integrity:
//   1. Every wire in a graph's `wires` list is referenced by both endpoints'
//      `port.connections` arrays AND both endpoints' nodes belong to that graph.
//   2. Every wire referenced by any `port.connections` is present in its
//      owning graph's `wires` list.
// A violation of either direction is a phantom wire: it appears in one place
// but not the other, and codegen vs. UI will disagree about whether it exists.
//
// Skip when no blueprint is present (e.g., pure unit tests that don't bootstrap).
export function assertNoPhantomWires(bp) {
  if (!bp || !bp.graphs) return;

  // Index every wire → the graph that claims to own it (via graph.wires).
  const wireToGraph = new Map();
  for (const graph of bp.graphs.values()) {
    for (const wire of graph.wires || []) {
      if (wireToGraph.has(wire)) {
        throw new Error(
          `Phantom wire: same wire in two graphs' wires lists`
        );
      }
      wireToGraph.set(wire, graph);
    }
  }

  // Direction 1: every wire in a graph's list must be referenced by both ports.
  for (const [wire, graph] of wireToGraph) {
    const { startPort, endPort } = wire;
    if (!startPort || !endPort) {
      throw new Error(`Phantom wire in graph "${graph.name || graph.id}": wire has null endpoint(s)`);
    }
    if (!startPort.connections.includes(wire)) {
      throw new Error(
        `Phantom wire in graph "${graph.name || graph.id}": wire is in graph.wires but startPort.connections does not include it`
      );
    }
    if (!endPort.connections.includes(wire)) {
      throw new Error(
        `Phantom wire in graph "${graph.name || graph.id}": wire is in graph.wires but endPort.connections does not include it`
      );
    }
  }

  // Direction 2: every wire referenced by a port.connections must be in some
  // graph's wires list — specifically, the graph the port's node lives in.
  for (const graph of bp.graphs.values()) {
    for (const node of graph.nodes || []) {
      const allPorts = [...(node.inputPorts || []), ...(node.outputPorts || [])];
      for (const port of allPorts) {
        for (const wire of port.connections || []) {
          const owner = wireToGraph.get(wire);
          if (!owner) {
            throw new Error(
              `Phantom wire in graph "${graph.name || graph.id}": port "${port.name}" on node ${node.id} references a wire not in any graph.wires`
            );
          }
          if (owner !== graph) {
            throw new Error(
              `Phantom wire: port "${port.name}" on node ${node.id} (graph "${graph.name || graph.id}") references a wire owned by a different graph ("${owner.name || owner.id}")`
            );
          }
        }
      }
    }
  }
}

afterEach(() => {
  const bp = globalThis.__bp;
  if (!bp) return;
  assertNoPhantomWires(bp);
});
