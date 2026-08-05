// Browser APIs jsdom doesn't ship, stubbed just enough for BlueprintSystem to
// construct and run. Shared by the vitest setup and the CLI's node host so
// there is one definition of "what headless has to fake".
//
// None of this touches a GPU: the canvas 2D context is a no-op recorder used
// only so render() can run, and measureText returns a fixed width.

function makeCtx2D() {
  const noop = () => {};
  return {
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
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
    createImageData: (w, h) => ({
      data: new Uint8ClampedArray((w || 1) * (h || 1) * 4),
      width: w || 1,
      height: h || 1,
    }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
}

// The MCP bridge opens a WebSocket on construct; this keeps it from trying a
// real connection.
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

// Plain assignment fails when the target already has a getter-only property of
// that name, which happens when a host mirrors a jsdom window onto globalThis.
function put(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    writable: true,
  });
}

/**
 * Apply the stubs to a window. `win` is the jsdom window; `global` is where
 * bare references (`requestAnimationFrame`, `WebSocket`) should resolve, which
 * is the same object under vitest and `globalThis` when we own the jsdom.
 */
export function installDomStubs(win = globalThis, global = globalThis) {
  const HTMLCanvasElement = win.HTMLCanvasElement;
  if (HTMLCanvasElement) {
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
      cb(new win.Blob([], { type: "image/png" }));
    };
  }

  if (typeof win.requestAnimationFrame !== "function") {
    put(win, "requestAnimationFrame", (cb) => setTimeout(() => cb(Date.now()), 0));
    put(win, "cancelAnimationFrame", (id) => clearTimeout(id));
  }
  put(global, "requestAnimationFrame", win.requestAnimationFrame);
  put(global, "cancelAnimationFrame", win.cancelAnimationFrame);

  // IndexedDB backs the recent-files list only; failing the open is enough.
  if (typeof win.indexedDB === "undefined") {
    const req = () => {
      const r = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null,
      };
      setTimeout(() => r.onerror && r.onerror({ target: r }), 0);
      return r;
    };
    put(win, "indexedDB", { open: req, deleteDatabase: req });
    put(global, "indexedDB", win.indexedDB);
  }

  if (typeof win.WebSocket === "undefined") {
    put(win, "WebSocket", FakeWS);
    put(global, "WebSocket", FakeWS);
  }

  if (typeof win.matchMedia !== "function") {
    put(win, "matchMedia", () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  }

  if (!("devicePixelRatio" in win)) {
    Object.defineProperty(win, "devicePixelRatio", {
      value: 1,
      configurable: true,
    });
  }
}
