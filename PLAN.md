# Function & Loop Body Subgraphs — Implementation Plan

Branch: `functions-and-loops` (off `main`)
Status: Ready to execute
Supersedes: `FUNCTIONS_FORLOOP_PLAN.md` from the abandoned `experimental-2` branch.

---

## 1. Goal

Add two new kinds of subgraph to the existing multi-graph editor:

- **Function graphs** — isolated subgraphs with a typed input/output contract. Callable from any other graph via a dynamically generated `FunctionCall` node.
- **Loop body graphs** — like functions but with extra structure (accumulator + arg roles, an auto-injected `Index` input). Used by a dynamically generated `ForLoop` node which wraps the body in a `for` loop.

Both compile to real shader functions and integrate with codegen, save/load, history, and undo/redo.

---

## 2. Design decisions (locked in)

| #   | Decision                                                                                                                                                                                                                            | Rationale                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Functions and loop bodies ARE Graphs.** Add `kind: 'main' \| 'function' \| 'loopBody'` and a `data` bag to `Graph`.                                                                                                               | Reuses the existing `graphs` Map, `setActiveGraph`, per-graph history, save/load, property delegation. No parallel registry.     |
| 2   | **Sibling kinds `function` and `loopBody`. No runtime conversion.** Per-kind logic lives in `graph-kinds/` handler modules, not in `Graph` subclasses.                                                                              | Keeps `Graph.js` as pure storage. Kind is fixed at creation.                                                                     |
| 3   | **Tab bar above canvas + Functions sidebar section.**                                                                                                                                                                               | Standard pattern (Blueprints, ShaderGraph). Tabs are session-only navigation; not persisted.                                     |
| 4   | **Caller nodes are sidebar-draggable AND searchable.** Search keys `function_call_<id>` / `for_loop_<id>`.                                                                                                                          | Mirrors how Custom Nodes work today.                                                                                             |
| 5   | **Variables (`Set Variable` / `Get Variable`) are graph-local.**                                                                                                                                                                    | Keeps function reuse sound. Already true by construction; verify and test.                                                       |
| 6   | **Recursion and cycles are disallowed.** DFS check on caller add and contract sync.                                                                                                                                                 | GLSL/WGSL don't support recursion.                                                                                               |
| 7   | **Functions emit as real shader functions** in the dependency block before `main()`. Single output → return; multi-output → `out` params (GLSL) / struct return (WGSL).                                                             | Required for ForLoop. Avoids inlining bloat.                                                                                     |
| 8   | **Uniforms move from per-graph to host-level.**                                                                                                                                                                                     | One shader = one uniform set. Function graphs don't have their own settings.                                                     |
| 9   | **Custom Nodes remain host-shared and available in subgraphs.** No change.                                                                                                                                                          | Already correct.                                                                                                                 |
| 10  | **Contract ports drag-reorder.** No up/down buttons.                                                                                                                                                                                | UX consistency.                                                                                                                  |
| 11  | **Generics are first-class via definition-time inference + call-site monomorphization.** Unbound generics specialize per `(graphId, signature)` pair at codegen. Default new contract port type = fresh generic name (`T`, `U`, …). | GLSL/WGSL have no user-defined generics; monomorphization is the only option. Body-inferred case collapses to a single emission. |
| 12  | **View Code respects the active tab.** On function/loop tabs, show the function's compiled variant(s).                                                                                                                              | Function preview is never useful; View Code is.                                                                                  |

---

## 3. Architectural baseline (what's already on main, do not change)

- `Graph` class (`Graph.js`) owns per-graph state.
- Host (`BlueprintSystem` in `script.js`) owns `graphs: Map`, `mainGraphId`, `activeGraphId`.
- `createGraph` (`script.js:1951`), `setActiveGraph` (`:1958`), `deleteGraph` (`:1982`), `_resolveTargetGraph` (`:1998`).
- Property delegation layer (`script.js:1888-1948`): `this.nodes`, `this.history`, etc. transparently route to `activeGraph`. `_withGraph(g, fn)` pins reads to a specific graph (used by codegen + preview).
- Per-graph `HistoryManager` with `_exportGraphState` / `_loadGraphState`.
- Save/load supports `_additionalGraphs` (`script.js:12136`).
- Custom nodes system (host-shared) with `createNodeTypeFromCustomNode` (`:7758`), `updateCustomNodeInstances` pattern (`:5775-5910`).
- Existing 18-test multigraph contract suite (`tests/10-multigraph-contracts.test.js`) MUST stay green.

The plumbing is done. We layer function/loop semantics on top.

---

## 4. Data model

### 4.1 `Graph.js`

Add to constructor:

```js
this.kind  = opts.kind  || 'main';   // 'main' | 'function' | 'loopBody'
this.color = opts.color || null;     // sidebar/tab tint, optional
this.data  = opts.data  || {};       // freeform per-kind bag
Remove these uniform fields from Graph (they move to the host):

this.uniforms
this.deprecatedUniforms
this.deprecatedUniformsExpanded
this.uniformIdCounter
Per-kind data shapes:

kind === 'function'

data = {
  contract: {
    inputs:  [{ id, name, type }],   // type: concrete name or generic name string
    outputs: [{ id, name, type }],
  },
  notes: '',
}
kind === 'loopBody'

data = {
  contract: {
    inputs:  [{ id, name, type, role: 'acc' | 'arg' }],
    outputs: [{ id, name, type }],   // role implicitly 'acc'
  },
  notes: '',
}
Index : int is implicit on loop bodies — not stored in the contract, injected by enforceBoundaryRules.

id (port id) is a stable per-contract id (UUID or counter) so renames/reorders preserve wires across caller rebuilds.

contractVersion field on the graph: increments on any contract edit; used by callers to detect drift.

4.2 Host (BlueprintSystem, in script.js)

Add fields (in constructor where the multi-graph init happens, ~script.js:1030):

this.uniforms = [];
this.deprecatedUniforms = [];
this.deprecatedUniformsExpanded = false;
this.uniformIdCounter = 1;
Remove these four fields from the property-delegation list (script.js:1891-1916).

Add helpers:

createFunctionGraph({ name, color, contract }) → createGraph({ kind:'function', name, color, data:{ contract: contract||{inputs:[],outputs:[]}, notes:'' } }), then getHandler('function').bootstrapGraph(g, this). Returns the graph.
createLoopBodyGraph({ name, color, contract }) → same but kind:'loopBody'.
getCallableGraphs() → [...graphs.values()].filter(g => g.kind === 'function' || g.kind === 'loopBody').
getGraphKindHandler(graph) → getHandler(graph.kind).
createGraph, setActiveGraph, deleteGraph are unchanged.

5. New module graph-kinds/

Per-kind dispatch layer. Keeps Graph.js as storage and prevents kind logic from sprawling across script.js.

graph-kinds/
  index.js              // export getHandler(kind)
  function-kind.js
  loop-body-kind.js
5.1 Handler interface

Each handler exports an object:

{
  kind,                                // 'function' | 'loopBody'
  label,                               // 'Function' | 'Loop Body'
  defaultColor,                        // string (hex)

  // ---- Contract ----
  validateContract(contract),          // returns string[] of error messages
  defaultPort(existingPorts),          // returns a fresh port { id, name, type, ... }

  // ---- Editor / sidebar ----
  renderContractEditor(graph, host, container),
                                       // populates the Function Info / Contract panels

  // ---- Boundary nodes ----
  bootstrapGraph(graph, host),         // adds the Function Input + Function Output nodes
  enforceBoundaryRules(graph, host),   // rebuilds boundary node ports from contract,
                                       // re-injects Index for loopBody, prevents deletion

  // ---- Caller node-type factory (used in OTHER graphs) ----
  createCallerNodeType(graph, host),   // FunctionCall (function) or ForLoop (loopBody)
  callerSearchPrefix,                  // 'function_call' | 'for_loop'

  // ---- Codegen ----
  computeCallSiteSignature(callerNode, host),
                                       // returns { sigHash, inputTypes, outputTypes, bindings }
  emitFunctionDeclaration(graph, signature, target, host),
                                       // returns shader source for one variant
  emitCallSite(callerNode, signature, ctx),
                                       // returns code at the call site
}
getHandler(kind) in index.js returns the right handler or null for 'main'.

index.js also exports getCallDAG(host) and wouldCreateCycle(host, fromGraphId, toGraphId) for cycle detection.

6. New node types

6.1 nodes/FunctionInputNode.js

name: "Function Input"
Outputs: derived from owning graph's data.contract.inputs. For loopBody, prepended with a fixed Index : int output that is immutable.
Inputs: none.
Color: NODE_COLORS.functionBoundary (new entry in nodes/PortTypes.js or the color table).
No shader code (getDependency returns '', getExecution returns () => ''). Codegen reads the contract directly to build the function's parameter list.
Flags:
requiresFunctionContext = true — search-menu hides it when active graph is main.
uniqueWithinGraph = true — at most one per graph, enforced by enforceBoundaryRules.
undeleteable = true (or equivalent existing flag) inside its graph; deletion attempts surface a notification.
6.2 nodes/FunctionOutputNode.js

Mirror of FunctionInputNode but for outputs. Inputs derived from data.contract.outputs. No outputs. Same flags.
6.3 Registration

Register both in nodes/index.js.
Add functionBoundary color in nodes/PortTypes.js (or the existing color enum).
Update getFilteredNodeTypes() in script.js to hide them when activeGraph.kind === 'main'.
7. Caller node types (dynamic)

Generated on demand from a target graph's contract. Mirrors the customNode pattern at script.js:7758 (createNodeTypeFromCustomNode).

7.1 FunctionCall (function-kind)

inputs:   contract.inputs   (one port each, in contract order)
outputs:  contract.outputs  (one port each, in contract order)
metadata: { targetGraphId, contractVersion }
Search-menu key: function_call_<graphId>.

7.2 ForLoop (loop-body-kind)

inputs:
  Count : int
  for each contract.inputs where role==='acc':
    "Initial <name>" : <type>
  for each contract.inputs where role==='arg':
    "<name>" : <type>
outputs:
  for each contract.outputs:
    "<name>" : <type>
metadata: { targetGraphId, contractVersion }
Search-menu key: for_loop_<graphId>. Only generated for graphs of kind loopBody.

7.3 Wire-up points

getFilteredNodeTypes(): enumerate getCallableGraphs() and merge in dynamic types via each handler's createCallerNodeType.
getNodeTypeKey(node): handle function_call_* and for_loop_* prefixes (mirrors custom_* at script.js:5819).
getNodeTypeFromKey(key): same.
createNodeFromType already accepts arbitrary node types; no change needed.
7.4 Contract sync

When a contract changes, mirror updateCustomNodeInstances() (around script.js:5775-5910):

Bump that graph's contractVersion.
Walk every graph's nodes; for any caller whose metadata.targetGraphId matches, rebuild its ports against the new contract.
Preserve wires whose endpoint port id still exists with a compatible type. Drop incompatible wires.
Surface a single notification listing affected calls and dropped wires.
Recorded as one undoable action that spans multiple graphs (see §10).
8. Generics (first-class)

8.1 Storage

port.type is a free-form string. It accepts:

A concrete type: 'float', 'vec2', 'vec3', 'vec4', 'int', etc. (whatever PortTypes.js already enumerates).
A generic name: a non-concrete identifier like 'T', 'U'. New contract ports default to 'T', then 'U', etc. (incrementing first letter, skipping any in use within the same contract).
8.2 Definition-time inference

When a generic-typed body port (output of Function Input, or input of Function Output) is connected to a node port that resolves to a concrete type, the standard type-propagation engine pins the generic to that concrete type for display purposes. The resolved concrete type is shown in the contract editor next to the generic name (T (resolved: float)).

If the body has at least one such concrete pin, codegen emits a single function variant with the resolved types — no per-call-site duplication.

8.3 Call-site monomorphization (when body inference leaves a generic unbound)

At a call site (FunctionCall or ForLoop), every port sharing the same generic name in the contract unifies to the same concrete type per call instance. The first concrete type that arrives via a wire pins the generic for that instance; later wires must match.

Each call site computes a signature: a tuple of resolved input types + output types. Codegen groups call sites by (targetGraphId, sigHash) and emits one specialized function per unique pair.

Variant names: fn_<graphId>_<shortSigHash> where shortSigHash is a short stable hash of the signature (e.g. first 6 hex chars of a sha1 of the signature string). Distinct names in BOTH GLSL and WGSL — no overloading — for parity and to avoid collisions with builtins.

If body inference has fully resolved the contract, all call sites compute the same signature and codegen emits exactly one function. The monomorphization layer is a no-op in that case.

8.4 Validation

Before codegen, walk the call DAG from main:

Every call site must resolve every generic. Unresolved → error pinned to the offending port: "Cannot resolve generic 'T' on FunctionCall foo: input 'a' is unconnected."
Loop body acc input/output pairing is by id (1:1). Their resolved types must unify to the same concrete type per call signature.
Index is fixed int, never generic.
8.5 View Code under generics

See §13. Multiple variants → multiple labeled blocks. Unused functions → speculative variant with the most-generic concrete fallback ('float' for unbound numeric generics).

9. UI

9.1 Tab bar (index.html + script.js + style.css)

In index.html, above <canvas id="canvas"> inside #canvas-container:

<div id="graph-tab-bar">
  <div id="graph-tabs"></div>
</div>
Behavior:

One tab per graph in host.graphs whose tab is "open".
Main graph tab is always present, leftmost, never closeable.
Each non-main tab shows: kind badge (small "fn" / "loop" pill), name (editable on double-click), close button (×).
Click → setActiveGraph(id).
Middle-click or × → close tab. Closing does NOT delete the graph from the project; it just hides the tab. Reopen by clicking the function in the Functions sidebar.
Tab open/close state and active-tab id are session-only; not persisted in save files.
Right-click context menu on a non-main tab: rename, change color, delete graph (warns if callers exist).
Tab tint uses graph.color if set, otherwise the kind's defaultColor.
9.2 Sidebar visibility per active kind

Section	main	function	loopBody
Shader Info	✓	hidden	hidden
Shader Settings	✓	hidden	hidden
Uniforms	✓	✓	✓
Custom Nodes	✓	✓	✓
Functions	✓	✓	✓
Function Info / Contract	hidden	✓	✓
Uniforms list reads from host-level host.uniforms and is identical across tabs.

9.3 Functions sidebar section

Add a collapsible section below "Custom Nodes" in index.html:

<div id="functions-section" class="collapsible-section">
  <div class="sidebar-section-header">
    <h2>Functions</h2>
    <button class="collapse-btn">▼</button>
  </div>
  <div class="sidebar-section-content">
    <div class="functions-add-row">
      <button id="addFunctionBtn">+ Function</button>
      <button id="addLoopBodyBtn">+ Loop Body</button>
    </div>
    <div id="functions-list" class="custom-nodes-list"></div>
  </div>
</div>
Each entry:

Color stripe matching graph.color.
Name + kind badge (fn / loop glyph).
Stats: <inputs>→<outputs> (e.g. 3→1).
Drag handle: drops a FunctionCall (function-kind) or ForLoop (loop-body-kind) into the active graph at cursor — same data-transfer pattern as Custom Nodes (script.js:5975).
Edit button: opens-and-switches to the function's tab (creating the tab if not currently open).
Delete button: confirms if any caller exists; lists affected graphs.
Renderer mirrors renderCustomNodesList.

9.4 Function Info / Contract panel

Visible only when activeGraph.kind !== 'main'. Composed of three sub-panels rendered by the active kind's renderContractEditor:

Function Info — name, color picker, notes textarea.
Inputs — list of contract input ports.
Outputs — list of contract output ports.
Each port row contains:

Drag handle for reordering (uses the same drag pattern as elsewhere — investigate the existing uniforms / custom node lists for the canonical drag implementation and reuse it).
Name input (text).
Type dropdown (concrete types + a "Generic" entry that prompts for the generic name, with a default of the next available letter).
For loopBody inputs: role selector (acc / arg).
Delete button.
Inline error indicator if validateContract flags this port.
For generic ports with body inference: small "resolved as: " hint.
+ Add Input / + Add Output buttons append a new port using defaultPort(...).

For loopBody, outputs are visually grouped with their paired acc input (same id pairing); a "Pair with input: " indicator on each output. (Pairing semantics: an acc output's id matches an acc input's id to indicate they represent the same accumulator state.)

Edits push a single undoable action and trigger the sync from §7.4.

9.5 Reorder

Drag-reorder ports updates contract order. Wires preserved (binding is by id, not order). Caller nodes regenerate with new visual order; this is the only behavior change of reorder.

9.6 What changes in index.html

Add #graph-tab-bar block inside #canvas-container.
Add #functions-section in the sidebar.
Add #function-info-section, #function-inputs-section, #function-outputs-section (all display:none by default; shown by JS when active graph has a kind handler).
Existing #shader-info-section, #shader-settings-section get JS-controlled visibility based on active kind.
9.7 What changes in style.css

Tab bar styles: horizontal scrollable strip, active-tab highlight, kind badge pill, color stripe.
Function badge styles in sidebar entries.
Drag-handle / drag-over styles for contract port reorder (reuse if pattern exists).
10. Save / load

10.1 Per-graph entry

Each entry in top-level _additionalGraphs is extended:

{
  id, name,
  kind,           // NEW: 'function' | 'loopBody'
  color,          // NEW
  data,           // NEW: { contract, notes }
  contractVersion, // NEW
  // ...existing: nodes, wires, comments, nodeIdCounter, commentIdCounter,
  //              wireIdCounter, camera, fileHandle (null), shaderSettings (unused)
}
Backward compat: missing kind defaults to 'function' for additional graphs (top-level main is always 'main'). Missing data defaults to { contract: { inputs: [], outputs: [] }, notes: '' }.

10.2 Top-level uniforms migration

Top-level fields:

uniforms: [...],
deprecatedUniforms: [...],
uniformIdCounter: N,
Loader (loadFromJSON, script.js:12101+):

If top-level uniforms present → load into host.
Else if mainGraph payload has uniforms → load those into host (migration from old format), and ignore on additional graphs.
Else → empty.
Saver (saveToJSON):

Always write uniforms at top level. Do NOT write uniforms inside per-graph payloads.
10.3 Post-load

After all graphs are loaded:

Run getHandler(g.kind).enforceBoundaryRules(g, this) on each non-main graph (catches hand-edited or migrated files).
Recompute caller node types so existing FunctionCall/ForLoop instances rebuild their ports against loaded contracts (calls into the same path as the contractVersion sync).
Refresh sidebar and tab bar.
10.4 Schema version

Bump file version to a new minor or set a separate multiGraphFormat: 2 flag if needed to disambiguate. Old files (no _additionalGraphs, no top-level uniforms) load exactly as today.

11. History / undo-redo

Existing per-graph HistoryManager design unchanged for main-graph contents.

11.1 Diff metadata

HistoryManager.js extension (mirrors the customNodesChanged precedent at :225):

diff.contractChanged = false;
// ...
if (!this.deepEqual(oldState.contract, newState.contract)) {
  diff.contractChanged = true;
  diff.changedProperties.add('contract:changed');
}
exportState for non-main graphs includes kind, color, data (which contains contract).

11.2 Multi-graph undo entries

A contract edit on graph G triggers caller rebuilds on graphs A, B, C, ….

Approach: extend the host with a "transaction" wrapper that captures snapshots of every affected graph before and after, stored as a single undo step:

host.runMultiGraphTransaction(['G','A','B','C'], () => {
  // edit contract on G; sync rebuilds A, B, C
});
Undo restores all affected graphs to their pre-edit snapshots. Redo replays.

If implementing the transaction wrapper is invasive, fall back to: push the contract change onto G's history, and push synthetic "contract sync" entries onto each affected graph's history that share a transaction id; undo on any of them rolls back the whole group. Either approach is acceptable — pick whichever is cleaner against the existing HistoryManager shape.

11.3 Non-undoable actions

Tab open/close
Active graph switch
Graph create / delete (matches today: graph deletion is confirmed and reversed only by reload; graph creation is confirmed by the user creating it)
12. Variable scoping

Already graph-local by construction. Verify and add tests:

Set Variable / Get Variable enumeration in the sidebar dropdown filters by activeGraph.nodes.
Codegen for a function compiles inside _withGraph(functionGraph, () => ...), so variable lookups are scoped to the function's nodes automatically.
Test (see §15): same-name Get Variable in a function vs main resolves independently.
No code change is expected here beyond confirming the dropdown filter and adding the test.

13. Cycle / recursion prevention

Build a directed graph where nodes are callable graphs and edges are (A → B) iff A contains a caller targeting B.

DFS cycle check in graph-kinds/index.js: wouldCreateCycle(host, fromGraphId, toGraphId).
Run on every caller-add (search-menu insertion AND sidebar drag) and on every contract sync.
Reject creation with notification: "Adding this would create a cycle: foo → bar → foo".
A function cannot call itself.
If a load brings in a cyclic file (shouldn't happen via the editor, but possible via hand-edit), reject codegen with a clear error rather than crash.
14. Codegen

14.1 Pipeline restructure

generateShader(target, levels, portToVarName) (script.js:10380) currently emits dependencies + main(). Restructure into THREE blocks (in this order):

Function declarations block (NEW)
Compute the call DAG from main.
For each callable graph reachable from main, determine the set of unique signatures from all reachable call sites (§8.3).
For each (graphId, signature) pair, call getHandler(g.kind).emitFunctionDeclaration(g, signature, target, host).
Emission order: reverse topological — callees before callers.
Each emitted function compiles its body using _withGraph(g, () => buildLevels(...)) with boundary types bound to the signature.
Each function's internal dependencies (helper functions, custom-node deps, struct definitions for multi-output WGSL) are added to the dependency dedupe map shared with block 2.
Dependency block (existing, extended)
Same dedupe logic as today (script.js:10384).
Now also receives deps contributed by function declarations and any generated WGSL output structs.
main() body (existing)
FunctionCall and ForLoop nodes contribute call-site code (§14.3, §14.4) instead of inline shader code; everything else unchanged.
14.2 emitFunctionDeclaration(g, signature, target, host)

Variant name: fn_<graphId>_<sigHash> (or just fn_<graphId> if there's only one signature for that graph — keeps simple cases readable).

GLSL (WebGL1 / WebGL2), single output:

<outType> <fnName>(<inType1> <inName1>, <inType2> <inName2>, ...) {
  <body>
  return <outVar>;
}
GLSL, multiple outputs — use out parameters:

void <fnName>(<inputs>, out <outType1> <outName1>, out <outType2> <outName2>, ...) {
  <body>
  <outName1> = <var1>;
  <outName2> = <var2>;
  ...
}
WGSL, single output:

fn <fnName>(<in1Name>: <in1Type>, ...) -> <outType> {
  <body>
  return <outVar>;
}
WGSL, multiple outputs — generate a struct, add it to deps:

struct <Fn>Out { o1: <outType1>, o2: <outType2>, ... };
fn <fnName>(<inputs>) -> <Fn>Out {
  <body>
  return <Fn>Out(<var1>, <var2>, ...);
}
Loop body compilation uses the same rules. Parameter order: Index first (always int), then accumulators in declared order, then args. Outputs are accumulators.

Body compilation reuses the existing levels builder. The Function Input node's outputs map to the function's parameters; the Function Output node's inputs map to the values written to outputs.

14.3 FunctionCall call site

// single output
<outType> <var> = <fnName>(<inVar1>, <inVar2>, ...);

// multi-output GLSL
<outType1> <var1>; <outType2> <var2>; ...
<fnName>(<inVar1>, ..., <var1>, <var2>, ...);

// multi-output WGSL
let <tmp> = <fnName>(<inVar1>, ...);
let <var1> = <tmp>.o1;
let <var2> = <tmp>.o2;
14.4 ForLoop call site

For a loop body whose contract has acc inputs a1..aN, arg inputs g1..gM, and acc outputs paired 1:1 with a1..aN:

// initialize accumulators from "Initial <ai>" inputs
<aT1> <a1Var> = <init1>;
...
<aTN> <aNVar> = <initN>;

for (int i = 0; i < <countVar>; i = i + 1) {
  // multi-output handling per §14.3
  <fnName>(i, <a1Var>, ..., <g1Var>, <g2Var>, ..., <a1Var>, <a2Var>, ..., <aNVar>);
  // (using out-params in GLSL writes back into the same accumulator vars)
}

// outputs of the ForLoop node = a1Var..aNVar
WGSL variant uses struct return and reassigns each acc field per iteration:

var <a1Var>: <aT1> = <init1>;
...
for (var i: i32 = 0; i < <countVar>; i = i + 1) {
  let r = <fnName>(i, <a1Var>, ..., <g1Var>, ..., <a1Var>, ..., <aNVar>);
  <a1Var> = r.o1;
  ...
  <aNVar> = r.oN;
}
14.5 Pre-codegen validation

Before generateShader runs, walk the call DAG from main. Reject (single notification, no broken shader source) if:

Any callable graph missing or duplicating Function Input or Function Output.
Any loop body has an acc output without a matching acc input (by id) of the same resolved type per signature.
Any contract port has an unresolved generic at a call site.
Any cycle exists.
Errors are pinned to specific nodes/graphs so the user can navigate to the problem.

15. View Code

activeGraph.kind === 'main': unchanged — full shader.

activeGraph.kind === 'function' || 'loopBody':

Compile the function and show its declaration(s) for the currently selected language.
If multiple monomorphized variants are in use by main, show each variant with a header comment:
// Variant: lerp(vec3, vec3, float) -> vec3
vec3 fn_3_a1b2c3(vec3 a, vec3 b, float t) { ... }

// Variant: lerp(float, float, float) -> float
float fn_3_d4e5f6(float a, float b, float t) { ... }
If the function is unused by main, compile a speculative variant using the most-generic concrete fallback per port ('float' for unbound numeric generics) and prepend:
// Note: not currently used; showing speculative compilation.
Include transitive dependencies (custom-node deps, called sub-functions, generated structs) above the function so the snippet is self-contained.
The language switcher continues to work.
Wire this in by branching at the top of the View Code modal's open handler on activeGraph.kind.

16. Tests (vitest)

Add new files; existing 18 multigraph tests must stay green.

File	Coverage
tests/11-graph-kinds.test.js	Creating function & loop-body graphs sets kind, color, data. Bootstrapping adds Function Input + Function Output nodes. Boundary nodes' ports match contract. enforceBoundaryRules re-injects Index for loopBody.
tests/12-contract-sync.test.js	Add/remove/rename/reorder contract ports rebuild caller node ports. Wires preserved by port id; incompatible types dropped. Reorder preserves all wires. contractVersion increments.
tests/13-cycle-prevention.test.js	Direct A→A rejected. Indirect A→B→A rejected. Deep cycles caught. Adding a non-cycle-creating caller succeeds.
tests/14-variable-isolation.test.js	Set Variable in main and Set Variable with the same name in a function are independent. Get Variable in a function does not resolve to main's Set.
tests/15-function-codegen.test.js	Single-output, multi-output (out-params GLSL, struct return WGSL). Nested function calls. Dependency dedupe. Body inference resolves to a single variant.
tests/16-loop-codegen.test.js	Accumulator initialization, args passthrough, Index parameter, multi-acc, multi-iteration WGSL/GLSL parity.
tests/17-save-load-functions.test.js	Round-trip a project with mixed function + loopBody graphs. Contracts, kinds, colors, notes preserved. Caller instances resync after load.
tests/18-uniforms-host-level.test.js	Uniforms are accessible identically from any active graph. Adding a uniform from a function tab is reflected on the main tab. Migration from old per-graph uniform location works on load.
tests/19-generics-monomorphization.test.js	Fully-generic lerp body emits one variant per call signature with distinct mangled names. Body-inferred function emits one variant. Unconnected generic at a call site surfaces a clear error. GLSL and WGSL output both validated.
If the test harness setup files were removed in experimental-2, restore from main and extend; do NOT delete existing test infrastructure.

17. Files

17.1 New files

graph-kinds/index.js
graph-kinds/function-kind.js
graph-kinds/loop-body-kind.js
nodes/FunctionInputNode.js
nodes/FunctionOutputNode.js
tests/11-graph-kinds.test.js
tests/12-contract-sync.test.js
tests/13-cycle-prevention.test.js
tests/14-variable-isolation.test.js
tests/15-function-codegen.test.js
tests/16-loop-codegen.test.js
tests/17-save-load-functions.test.js
tests/18-uniforms-host-level.test.js
tests/19-generics-monomorphization.test.js
17.2 Modified files

Graph.js — add kind, color, data, contractVersion. Remove the four uniform fields.
script.js — add host-level uniform fields and remove from delegation. Add createFunctionGraph, createLoopBodyGraph, getCallableGraphs, getGraphKindHandler. Search-menu integration (getFilteredNodeTypes, getNodeTypeKey, getNodeTypeFromKey). Sidebar rendering with per-kind visibility (§9.2). Functions sidebar render. Contract editor mount points. Tab bar render + interactions. Contract sync (§7.4) and multi-graph undo (§11.2). Save/load extension + uniform migration. Codegen restructuring (generateShader) and call-site emission. View Code branch by active kind. Drag-reorder for contract port lists (reusing existing drag pattern).
index.html — #graph-tab-bar; Functions sidebar section; Function Info / Inputs / Outputs panels; JS-controlled visibility on existing Shader Info / Shader Settings sections.
style.css — tab bar styles; function badge; drag handle / drag-over styles for contract reorder.
HistoryManager.js — add contractChanged diff field (small mirror of customNodesChanged).
nodes/index.js — register Function Input + Function Output.
nodes/PortTypes.js (or color table) — add functionBoundary color.
17.3 Untouched

Property delegation core (still kind-agnostic; just shrinks by 4 fields).
setActiveGraph / createGraph / deleteGraph.
Custom nodes system.
Preview pipeline (always renders main).
All other node types.
18. Phase order

Each phase ends with all tests green and a working app. No broken intermediate states.

Phase 1 — Scaffolding

Create branch.
Add kind, color, data, contractVersion to Graph.js (with no behavior change yet).
Move uniforms to host; remove from delegation; add backward-compat loader.
Create empty graph-kinds/index.js, function-kind.js, loop-body-kind.js with stub handlers.
Add test 18 (uniforms host-level migration).
All existing tests + test 18 green.
Phase 2 — Boundary nodes

Create nodes/FunctionInputNode.js and nodes/FunctionOutputNode.js.
Register in nodes/index.js.
Add functionBoundary color.
Implement bootstrapGraph and enforceBoundaryRules in both kind handlers (minimum viable).
Add requiresFunctionContext filter in search menu.
Test 11 green.
Phase 3 — Function kind end-to-end

Implement full function-kind.js: validateContract, defaultPort, renderContractEditor, createCallerNodeType, computeCallSiteSignature, emitFunctionDeclaration, emitCallSite.
Implement createFunctionGraph on host.
Wire FunctionCall into search menu and getNodeTypeKey / getNodeTypeFromKey.
Implement contract sync (§7.4).
Restructure codegen (§14.1) for normal function declarations and call sites — generics path included from the start.
Definition-time inference works.
Tests 12, 14, 15, 17 green.
Phase 4 — UI

Add #graph-tab-bar and tab interactions.
Add Functions sidebar section + drag-to-canvas.
Mount Function Info / Inputs / Outputs panels; render via function-kind.renderContractEditor.
Per-kind sidebar visibility (§9.2).
Drag-reorder for contract ports (reuse existing drag pattern).
View Code branch by active kind (§15) — function variant display included.
Manual QA pass.
Phase 5 — Loop body kind

Implement full loop-body-kind.js: role-aware contract editor, ForLoop caller type, ForLoop emission (§14.4).
enforceBoundaryRules injects Index and protects it.
Acc input/output pairing UI.
Test 16 green.
Phase 6 — Cycles + validation polish

Implement wouldCreateCycle and gate caller add at search-menu and sidebar drag.
Pre-codegen validation messages (§14.5).
Test 13 green.
Phase 7 — Generics call-site monomorphization polish

Confirm signature grouping in emitFunctionDeclaration produces correct distinct variants.
Confirm View Code multi-variant display.
Test 19 green.
Phase 8 — Save/load + history polish

Verify multi-graph round-trip.
Verify multi-graph undo for contract edits + caller sync (§11.2).
Test 17 finalized; manual undo/redo across contract edits verified.
Phase 9 — Manual QA

Preview/export still work for projects with and without functions.
WebGL1, WebGL2, WGSL parity for both FunctionCall and ForLoop.
Multi-language View Code on function tabs.
Save → close → reload preserves everything.
19. What this plan deliberately does NOT do

Generics constraint inference beyond simple body propagation. If the body uses generic-only operations everywhere, T stays unbound — that's fine; it specializes at the call site.
Function color theming on caller instances. Sidebar and tab get the color; FunctionCall and ForLoop nodes stay neutral so they don't compete with port-type colors.
Previewing a function in isolation. Confirmed never useful.
Exporting a function as a reusable artifact (separate file, library, etc.). Not now.
Function-level shader settings. Functions don't have shader settings; only the main graph does.
20. Reference: pitfalls in the abandoned experimental-2 branch (avoid these)

Stored functions in a parallel host.functions[] array instead of using the existing graphs Map. Result: duplicated persistence, special swap pattern (_captureCurrentGraph / _restoreGraph) that fought the property-delegation layer.
Deleted the entire tests/ directory and vitest.config.js. Do not delete tests; extend them.
Replaced Graph.js (151 lines of clean per-graph state extraction) with re-inlined state on the host. Keep Graph.js as the storage class.
Created a 1266-line standalone mockup-functions.html instead of integrating into index.html. Integrate into the real UI from the start.
Treated function contract as a node-instance property (createDefaultData = () => ({ functionId: null })). The contract belongs to the owning graph, not to its boundary node instances.
21. Decision summary (one-line each)

Function = Graph with kind and data.
Two sibling kinds: 'function' and 'loopBody'. No conversion. Per-kind handlers in graph-kinds/.
Tab bar above canvas + Functions sidebar. Tab open/close is session-only.
Caller nodes: sidebar-draggable + searchable (function_call_<id>, for_loop_<id>).
Variables graph-local. Recursion/cycles disallowed.
Functions emit as real shader functions. Multi-output: out params (GLSL), struct return (WGSL).
Uniforms move to host-level. Custom Nodes unchanged.
Contract ports drag-reorder. Default port type is a fresh generic name (T, U, …).
Generics first-class: definition-time inference + call-site monomorphization for unbound. Distinct mangled variant names in both GLSL and WGSL.
View Code respects active tab. Multiple variants → multiple labeled blocks.

---

That's the complete plan. When you're ready to execute (or hand off), exit plan mode and either you or the next agent can save it as `FUNCTIONS_AND_LOOPS_PLAN.md` at the repo root, then start with Phase 1.
```
