# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server on port 3002
npm run build     # Production build → dist/
npm run test      # Run test suite (Vitest)
npm run test:watch  # Watch mode
npm run cli -- <cmd>  # Headless CLI (see cli/), e.g. `npm run cli -- validate x.c3sg`
```

Run a single test file: `npx vitest run tests/codegen.test.js`

## Architecture Overview

**Construct Shader Graph** is a visual node-based shader editor that generates GLSL/WGSL code for WebGL 1, WebGL 2, and WebGPU targets. It's a vanilla JavaScript SPA with no framework.

### Layers

| Layer | Key Files |
|---|---|
| Host/system | `script.js` — `BlueprintSystem` class (16K lines): canvas rendering, event handling, codegen, save/load, preview, dialogs |
| Graph model | `Graph.js` — per-graph state (nodes, wires, comments, camera, history) |
| Node definitions | `nodes/index.js` — registry of ~265 node types; each file is a `NodeType` instance |
| Code generation | Inside `script.js`: `generateShader()`, `calculateExecutionLevels()`, `generateVariableNames()` |
| History | `HistoryManager.js` — snapshot-based undo/redo with 1-second coalescing |
| Graph kinds | `graph-kinds/` — per-kind dispatch for `function` and `loopBody` graphs |
| Headless boot | `headless/boot.js` — mounts `index.html` in jsdom and imports `script.js`; shared by tests and CLI |
| CLI | `cli/` — thin transport over `shaderGraphAPI.call()`; see "CLI" below |
| Preview runtime | `preview/` — **generated** Construct 3 export loaded in an iframe; `preview-src/` is the project it came from. See "Preview" below |

### CLI

`cli/` contains **no shader, graph or codegen logic**. Every command reduces to
`read file → shaderGraphAPI.call(method, args) → write file`. If a command needs
behaviour the app lacks, add it to `script.js` / `GlobalConsoleApi.js` first —
then the app gains it too and the two cannot drift.

- Two hosts, one `call(path, args)` interface: `cli/host/node.js` (jsdom + Vite
  `ssrLoadModule`, used by everything) and `cli/host/browser.js` (Playwright +
  the real app, used only by `preview`, which needs a GPU for the C3 runtime).
- `csg api` is generated from `api.getManifest()` — new API methods need no CLI code.
- `tests/28-cli-parity.test.js` asserts CLI output is byte-identical to the app's
  own for every example. That is the guard against duplication creeping back in.

### Preview

`preview/` is a **generated** Construct 3 web export. `preview-src/` is the Construct
project it came from — that is the source of truth. Preview behaviour lives in
`preview-src/scripts/main.js`; Construct copies script files verbatim on export, so it and
`preview/scripts/project/main.js` must stay byte-identical
(`tests/31-preview-source-parity.test.js` enforces it). Edit the source file, copy it over
the export, done — no re-export needed for script-only changes.

Changing project **structure** (object types, layout, event sheet, project properties) does
need a re-export from the Construct editor, which only a human can run. See
`preview-src/README.md` for that path and for the positional-index hazard it carries.

### Multi-Graph System

`BlueprintSystem` (host) owns a `Map<id, Graph>`. Two distinct graph IDs matter:
- `mainGraphId` — always used for code generation and preview
- `activeGraphId` — what the user is currently editing

Property access on `BlueprintSystem` (e.g., `this.nodes`, `this.wires`) delegates transparently to `activeGraph` via getters/setters.

Uniforms and custom nodes live at the host level, shared across all graphs.

### Code Generation Pipeline

1. **Topological sort** (`calculateExecutionLevels`) — orders nodes by data dependency
2. **Variable naming** (`generateVariableNames`) — maps each port to a shader variable name, reusing upstream outputs when safe
3. **Per-target codegen** — three independent passes (webgl1, webgl2, webgpu); each node's `NodeType.shaderCode[target].execution()` emits one or more lines
4. **Assembly** — boilerplate + uniform declarations + helper functions + execution code

Boilerplate templates live in `shaders/`. `getBoilerplate()` injects dynamic uniforms (extra samplers, depth) and placeholder replacements.

### Node Type Definition Shape

```javascript
new NodeType(
  name,
  inputs: [{name, type}, ...],   // 'float', 'vec3', 'genType', etc.
  outputs: [{name, type}, ...],
  color,
  shaderCode: {
    webgl1:  { dependency: string, execution: fn(inputs, outputs) → string },
    webgl2:  { dependency: string, execution: fn(inputs, outputs) → string },
    webgpu:  { dependency: string, execution: fn(inputs, outputs) → string },
  },
  category,
  tags
)
```

`genType` ports resolve to a concrete type at codegen time by following the wire chain. Unconnected `genType` inputs resolve to `float`.

### State Separation

- **Persistent** (serialized): nodes, wires, comments, uniforms, shader settings, graph metadata
- **Transient** (UI only): selection, camera, active drag, editing port

`exportState()` captures only persistent state. `Graph.js` owns both; HistoryManager snapshots only the persistent subset.

### Tests

`tests/` has 13 test files (bootstrap, history, codegen, serialization, multi-graph contracts, uniforms). `tests/setup.js` stubs Canvas 2D, IndexedDB, WebSocket, and RAF for jsdom.

### Notable Non-Obvious Details

- **Wire insertion**: dragging a node onto an existing wire auto-reroutes `source → node → dest`
- **Preview pin**: any output port can be pinned as the preview target; it's converted to `vec4` and sent to an embedded iframe; preview always runs against `mainGraph`
- **Reroute nodes**: visual-only nodes that don't emit shader code
- **Custom nodes**: host-level library of user-defined `NodeType` instances; `updateCustomNodeInstances()` patches all live instances when a definition changes
- **Canvas rendering**: text and shadow rendering are skipped below zoom thresholds (`drawTextZoomThreshold`, `drawShadowZoomThreshold`)
- **Phase 1 infrastructure**: `graph-kinds/` and `Graph.kind` are in place for upcoming subgraph support (functions, loop bodies); see `PLAN.md` for spec

### Vite Config Notes

- Virtual module `virtual:examples` loads example files at build time
- Production base path: `/construct-shader-graph/` (deployed to GitHub Pages)
- Build output: `dist/`
