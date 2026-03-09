## Other Ideas

- [ ] **Switch/Case** - Multi-way branch based on int value
- [ ] **Array Index** - Access array element by index

## MCP / API Feedback

- [ ] Optimize the MCP primarily for AI authoring workflows rather than low-level manual mutation ergonomics
- [ ] Add result references in `runCommands` so later commands can use nodes/wires created earlier in the same batch
- [ ] Improve batch failure handling with transactional mode or rollback support
- [ ] Return richer mutation errors with failing command index, node ids, port names, and resolved types
- [ ] Tighten API contract consistency for methods like `session.endAIWork` and validate argument shapes earlier
- [ ] Add higher-level graph editing helpers like `createAndConnect`, subgraph creation, and replace-connection operations
- [ ] Add an action to convert a fan-out output into `Set Variable` + multiple `Get Variable` nodes and then auto-layout the affected graph
- [ ] Make screenshot responses easier to consume than large in-band base64 blobs
- [ ] Add graph diff / recent mutations / undo-friendly inspection endpoints
- [ ] Add dry-run compatibility checks like `ports.canConnect(from, to)` before mutating
- [ ] Provide higher-level helpers or templates for common shader patterns like palette selection, Bayer dither, and fan-out cleanup

## Graph IR / DSL Proposal

- [ ] Add a declarative graph IR / DSL that is easier for AI to generate than low-level mutation calls
- [ ] Support stable local ids like `uv`, `sample1`, and `paletteSelect` instead of requiring runtime numeric ids during authoring
- [ ] Represent nodes with type, operation, editable inputs, uniform binding, and optional labels/comments
- [ ] Represent wires with readable refs like `from: "uv.UV"` and `to: "sample.UV"`
- [ ] Add `graph.validateIR(ir)` to resolve ports and types before any mutation happens
- [ ] Add `graph.importIR(ir, { validateOnly?: boolean })` to compile IR into real graph nodes and wires
- [ ] Add `graph.exportIR()` so an existing graph can round-trip back into the same portable format
- [ ] Add `graph.diffIR(old, next)` and/or `graph.applyIRPatch(patch)` for incremental graph updates
- [ ] Keep runtime numeric node ids as an execution detail instead of the authoring format
- [ ] Support optional groups / subgraphs / reusable macros in the IR format
- [ ] Make node positions optional or omitted in the IR and rely on auto-layout by default
- [ ] Make IR import deterministic so the same input produces the same graph structure every time
- [ ] Include detailed validation errors in IR import results with node ref, port ref, expected type, and actual type
