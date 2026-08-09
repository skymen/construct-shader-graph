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
| Code generation | Inside `script.js`: `generateShader()`, `buildDependencyGraph()`, `topologicalSort()`, `generateVariableNames()` |
| History | `HistoryManager.js` — snapshot-based undo/redo with 1-second coalescing |
| Constant folding | `constant-fold.js` — resolves a port to a compile-time value where the target demands a constant expression |
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

Uniforms, constants and custom nodes live at the host level, shared across all graphs.

### Code Generation Pipeline

1. **Reachability** (`buildDependencyGraph`) — BFS *backwards* from the Output (or pinned preview) node, so anything not feeding the output is never generated
2. **Topological sort** (`topologicalSort`) — groups the reachable nodes into dependency levels
3. **Variable naming** (`generateVariableNames`) — maps each port to a shader variable name, reusing upstream outputs when safe
4. **Per-target codegen** — three independent passes (webgl1, webgl2, webgpu); each node's `NodeType.shaderCode[target].execution()` emits one or more lines
5. **Assembly** — boilerplate + uniform declarations + constant declarations + helper functions + execution code

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

### Undo/Redo Contract

`pushState()` diffs the current graph against `currentStates` — the **last pushed** snapshot — and stores full before/after snapshots. Three consequences that anyone adding a mutation has to respect:

- **Every mutation of persistent state must push.** A mutation with no push leaves the baseline stale and gets folded into the *next* entry, so undoing an unrelated edit silently reverts it too. The symptom is "undo did something weird", not "that wasn't undoable".
- **The differ must be able to see the change.** If `calculateStateDiff` reports zero changed properties the entry is skipped *and* the baseline is left stale — the same leak. Adding a new snapshotted field usually means adding it to `calculateNodeDiff`'s key list.
- **Presentation-only mutations that still land in the snapshot** (node z-order) call `history.syncBaseline()` instead: no entry, but the baseline moves so nothing leaks.

`tests/06-undo-redo.test.js` holds the no-leak invariant as a table — do X, do something unrelated, undo once, X must still be there. Add a row when adding an action.

Push targeting follows `_graphOverride` (see `targetGraphId()`), so a mutation performed inside `_withGraph` records against the graph it actually edited. Multi-graph edits go through `runMultiGraphTransaction`, whose baseline is `currentStates` — so pin it with `syncBaseline()` before mutating if the mutation happens outside the transaction callback.

**Not undoable:** creating or deleting a function/loopBody graph. The entry model is per-graph, so the *set* of graphs isn't representable in a snapshot. `deleteGraph` calls `history.forgetGraph(id)` to drop entries that referenced it rather than leave undo steps that do nothing; deleting a callable graph does record the caller nodes and wires it takes down with it.

### Tests

`tests/` has 13 test files (bootstrap, history, codegen, serialization, multi-graph contracts, uniforms). `tests/setup.js` stubs Canvas 2D, IndexedDB, WebSocket, and RAF for jsdom.

### Notable Non-Obvious Details

- **Wire insertion**: dragging a node onto an existing wire auto-reroutes `source → node → dest`
- **Preview pin**: any output port can be pinned as the preview target; it's converted to `vec4` and sent to an embedded iframe; preview always runs against `mainGraph`
- **Reroute nodes**: visual-only nodes that don't emit shader code
- **Set/Get Variable are bound by name, not by a wire.** `Node.updateCustomInput` therefore retargets every Get Variable in the *owning graph* when a Set Variable is renamed — both the inline editor and `nodes.edit` go through it, so there is one place to change. `selectedVariable` is already in `calculateNodeDiff`'s key list, so the propagated rename rides the setter's own undo entry. `selectedVariableLinks()` exposes the same pairing to the renderer, which draws it as a dotted curve whenever either end is selected — the link is otherwise invisible on the canvas
- **Comment membership is geometric**: a comment owns whatever node centre currently sits inside it (`Comment.containsNode`) — there is no stored group. Anything that moves nodes therefore brackets itself with `captureCommentMembership()` / `refitCommentsToMembership()` (`script.js`, next to `createCommentAroundNodes`): snapshot before, refit after, then push overlapping comments apart until none intersect. Auto-arrange and `tidyVariables` both do this; pass `fitComments: false` to opt out. The refit is deliberately *inside* `AutoLayoutEngine.autoArrange` (before its `pushState`) so it lands in the same undo entry — `debugAutoArrange` bypasses the `script.js` wrapper, so a seam there would miss it
- **Comment separation** pairs siblings only (a nested comment overlaps its parent by design), moves each side of a pair half the minimum-translation vector plus a gap, and relaxes over up to 24 passes — separating one pair can push a comment onto a third. An *empty* comment is solid but pinned: it pushes, and the other side takes the whole displacement. Two comments sharing a member node are skipped and stay overlapping — no rigid translation separates two boxes that must both enclose the same node, and moving either one would just make the other's refit chase it. Nodes in no comment are never moved out of a displaced group's way. When passes run out with overlaps left it logs rather than reporting a clean layout; `csg lint` lists what remains as `overlappingComments`
- **Comment sizing has one rule**, `commentRectForContent()`: snug at `COMMENT_FIT_PADDING` on three sides, and on top the title bar plus however many lines the description wraps to — the description is painted over the comment body with nodes drawn on top, so a band too short leaves text under a node. Both `createCommentAroundNodes()` and the refit go through it, so creating and re-arranging agree, and a refit drops any slack the author dragged into the box. `wrapCommentDescription()` is shared with `drawComment()` so measuring and drawing cannot disagree; headlessly there are no real text metrics (the canvas stub answers every `measureText` identically), so it falls back to an average glyph width and can differ from the browser by a line
- **Comments are a layout constraint, not just a box.** `contractComments()` (`AutoLayoutEngine.js`) replaces each comment's members with one stand-in node before the layout runs, lays the interior out separately via `layoutNodeSet()`, and expands it in `applyLayout()`. The stand-in reserves the comment's *own* rect (`commentRectForContent`, padding and title band included), so after the refit the box exactly fills space the packer already set aside — tight by construction, and it cannot collide. Nesting works because contraction runs deepest-first. Two guards, both of which fall back to laying members out individually: a member set must be **convex** (no path leaves it and returns — otherwise a non-member has to be drawn between two members, and contracting would make the quotient graph cyclic), and it must not **share a node with a comment that doesn't contain it** (two unrelated boxes over one node feed the next arrange a different grouping than the last one produced, so the layout stops settling). Skipped entirely for `selectedOnly`, where a partly-selected comment would contract a partial set. `csg lint` reports both shapes as `nonConvexComment` / `commentSwallowsNode`
- **Every node in the arrange set gets a position.** The tree layout only covers one root's backward cone, so `findIndependentBranches()` splits a component by **sink cone** first — all sinks, cones computed before claiming, ordered terminal-first then by cone size then id, each node joining the first cone that claims it. That leaves every residual a valid tree whose sink is its unique root. A secondary cone that is a single node with inputs elsewhere becomes a **satellite**: parked beside its provider by `bp.parkNodeBesideItsSource()` after packing (shared with `tidyVariables`) rather than stacked a screen below. Nodes on a cycle reach no sink and become an extra branch, which `findRootNode` returns null for and `traditionalLayout` then places. `tests/49-auto-arrange-completeness.test.js` holds this as a corpus-wide invariant — it must run with `fitComments: false`, or comment separation moves unplaced nodes and hides the failure
- **Layouts are normalised** (`normalizeLayout()`) so positions start at the origin and the size is measured from real node rects. `arrangeBranchWithChildren` anchors the parent's right edge at `x = 0` and grows leftwards, but the packer and the branch stacker both reserve `[x, x + width]` — without normalising, the reserved area sits a full component-width right of the nodes and packed components can be placed through each other. Sizes come from `nodeWidthOf()` / `nodeHeightOf()`, which also answer for cluster stand-ins; `beginLayoutSession()` builds the id index they use
- **Custom nodes**: host-level library of user-defined `NodeType` instances; `updateCustomNodeInstances()` patches all live instances when a definition changes
- **Canvas rendering**: text and shadow rendering are skipped below zoom thresholds (`drawTextZoomThreshold`, `drawShadowZoomThreshold`)
- **Phase 1 infrastructure**: `graph-kinds/` and `Graph.kind` are in place for upcoming subgraph support (functions, loop bodies); see `PLAN.md` for spec
- **Constants**: host-level named compile-time values, emitted as `const` declarations. One `ConstantNode` serves every type via a `custom` output port plus `getCustomType`. Unlike uniforms they are not addon parameters, so there is no `paramId` and no deprecation tier
- **Constant folding**: `constant-fold.js` answers "is the value at this port knowable at codegen time?". A node opts in with `NodeType.foldConstant`. It is consulted **only** where the target language demands a constant expression — today, WebGL1 loop bounds, because GLSL ES 1.00 Appendix A is a grammar rule the driver's own folding cannot satisfy. Everywhere else the shader compiler already folds better
- **WebGL1 loop cap**: a loop whose Count does not fold runs to a constant cap and breaks early. Cap precedence: `callerNode.data.maxIterations` → the loop body's `graph.data.maxWebgl1Iterations` (sidebar field) → 64. `csg validate` warns whenever a loop is actually capped

### Vite Config Notes

- Virtual module `virtual:examples` loads example files at build time
- Production base path: `/construct-shader-graph/` (deployed to GitHub Pages)
- Build output: `dist/`
