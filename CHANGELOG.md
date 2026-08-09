# Changelog

This file is the app's own changelog: it is bundled into the build and rendered
by **Help > What's New**. Newest release first; each `##` heading starts one
entry and its version must match `package.json`.

## 1.0.0 — 2026-08-09

The first stable release.

### Functions and loop bodies

- **Function graphs:** subgraphs with a typed input/output,
  callable from any other graph. They compile to real shader functions.
- **Loop body graphs:** a subgraph with optional arguments and accumulators and an
  auto-injected `Index` input, wrapped in a `for` loop by the caller node.
- **Generic subgraphs:** a subgraph port can be generic and they get resolved at codegen,
  so one function can compile to multiple functions with different types based on what calls it.
- **Turn Into Function:** select a group of nodes and convert them into a
  function in place, wires and all.
- New tabs bar to show opened graphs.
- Variables are graph-local, so a function stays self-contained.
- **View Code** follows the active tab and shows the compiled function or loop.

### Constants

- **Constants** are named values, emitted as `const` declarations and
  shared by every graph.
- Loop bodies in WebGL1 need a constant loop count, so when possible the count
  resolves at codegen and uses it directly instead of going through a variable.
- A loop whose count cannot be resolves during code gen runs to a constant
  cap and breaks early on WebGL 1. The cap is settable per loop body in the
  info section and defaults to 64. On WebGL2 and WebGPU dynamic loops are
  supported so this is ignored.

### Preview

- **Multiple preview windows**, each with its own settings.
- **Pop out** a preview into its own browser window.
- **3D model support**, 3D rotation, and object offset.
- Render resolution and fullscreen quality settings.
- Background modes, and a reproduction mode for rotated spritesheet frames
  (Construct packs some frames sideways, which turns any texture-UV-to-layout
  mapping 90 degrees.)
- Preview settings are now saved with the project.

### Shader targets

- Choose which of WebGL 1, WebGL 2 and WebGPU a project supports. Disabled
  targets are skipped by codegen and left out of the exported addon.

### Command line

New `csg` CLI tool that runs part of the app headlessly for automation

- `create`, `validate`, `lint`, `arrange`, `codegen`, `export`, `comment`,
  `preview`, `run`, `repl`, `diff`, `paramid`, `api`.
- `csg validate` asks whether the shader compiles; `csg lint` asks whether the
  graph is readable afterwards (checks for dead nodes, auto-named variables, unrouted
  fan-out, crossing wires)
- `csg preview` returns a PNG preview of the current graph by running the preview headlessly
- `csg api --list` is generated from the API manifest, so a new API method is
  reachable from the CLI with no CLI code written.

### Layout and comments

- Rewritten auto-layout engine that should work a bit better with some cases,
  notably when multiple set variable nodes are used from the same node.
- **Comments are now layouted,** They act as a big node and anything inside
  of the comment gets layouted properly to stay within it and nicely packed.

### Nodes

- New: FBM 3D, SDF Gradient Color, Aspect Correct, Oscillate, Src Origin Size
  Px, Get/From Layout Pos (rotation-safe).
- Improved FBM, Rotate Around Point, Math, Texture Front/Back (edge sampling
  modes), Swizzle (manual entry), and the Epsilon/Pi/Tau constants.
- Manual entry for port types, and a button on each node that opens its manual
  page.

### Uniforms and project settings

- Each uniform carries a stable id, so renaming it no longer changes the
  exported addon's parameter id.
- Deleting a uniform first deprecates it for parameters that must stay in a published addon.

### Editing

- Reworked variables UX; renaming a Set Variable retargets every matching Get
  Variable in the same graph, and the pairing is drawn on the canvas when either
  end is selected.
- Double-click a comment body to edit it; comment text is always rendered.
- Better copy/paste, including across subgraphs.
- Undo/redo works across graphs and was made a bit more reliable.
- Moving the camera moves attached HTML elements with it.
- Keyboard shortcuts are now properly blocked while a dialog is open.
- Loading a file that uses unknown node types reports what was dropped instead
  of just deleting the nodes.

### Housekeeping

- The MCP bridge was removed, the CLI replaces it.
- Add Uniform, Add Custom Node, Add Function etc buttons were all moved to the bottom
  of their respective lists in the side bar
- Selecting a Get Variable/Set Variable node now shows a dotted wire to the linked nodes
- Changing a variable name in Set Variable now updates all the linked Get Variable nodes
