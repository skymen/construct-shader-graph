---
name: construct-shader-graph-console
description: Use the Construct Shader Graph browser console API to inspect graphs, edit nodes and wires, control preview, and report AI work status safely.
license: MIT
compatibility: opencode
metadata:
  audience: ai-agents
  domain: construct-shader-graph
  interface: browser-console-api
---

# Construct Shader Graph Console Skill

Use this skill to control Construct Shader Graph from the browser console through `window.shaderGraphAPI` or `window.sg`.

- Construct Shader Graph is a web page.
- URL: `https://skymen.github.io/construct-shader-graph/`

## Purpose

- Use this API to inspect the current graph, make targeted graph edits, validate the result, and report progress clearly.
- Prefer this API over poking random internals directly.
- Treat the graph as the source of truth for shader logic. Use preview controls only to inspect or demonstrate the result.

## Operating contract

- Preserve existing user work unless the task clearly requires replacing it.
- Inspect first, mutate second.
- Make the smallest valid change that satisfies the request.
- Verify after every structural edit such as creating nodes, deleting nodes, or wiring ports.
- Use stable ids from API results; do not rely on labels, visual position, or selection alone.
- Do not open arbitrary local files or save project files autonomously.
- Built-in examples are safe to open.
- Export is allowed because it triggers a download rather than silently overwriting a project.

## Execution priorities

1. Preserve the current graph and user intent.
2. Inspect the graph state before editing.
3. Prefer existing nodes and helper nodes over rebuilding standard shader math.
4. Prefer small, reversible edits over large speculative rewrites.
5. Verify graph integrity and preview behavior after each important edit.
6. End with a short recap.

## Hard rules

- Always call `sg.session.initAIWork()` when starting a task.
- Always call `sg.session.endAIWork()` when finishing a task.
- Use `sg.session.updateAIWork()` only for short phase updates.
- Never assume a node id, port index, or wire id without reading it first.
- Never connect ports without checking the actual node ports.
- Never replace an output connection blindly; inspect the affected ports first.
- Never use startup scripts as a substitute for graph logic.
- Never assume renderer-specific branching is needed; the tool already generates WebGL 1, WebGL 2, and WebGPU from one graph.
- Never create or edit custom node definitions unless the user explicitly asks for advanced custom node authoring.

## Preferred workflow

Use this loop for most tasks:

1. Start the session.
2. Inspect current graph state.
3. Identify exact node ids, port refs, uniform ids, or settings keys.
4. Apply one atomic edit or one tightly related batch.
5. Re-read the affected nodes, ports, wires, or settings.
6. Check preview or generated code if relevant.
7. Repeat only if needed.
8. End the session with a recap.

Example session skeleton:

```js
sg.session.initAIWork({ message: "Inspecting graph" })

const nodes = sg.nodes.list()
const output = nodes.find((node) => node.typeKey === "output")

sg.session.updateAIWork("Adding node")
const multiply = sg.nodes.create({ type: "multiply", x: 420, y: 180 })

sg.session.updateAIWork("Verifying")
sg.nodes.get(multiply.id)

sg.session.endAIWork({
  title: "AI task complete",
  summary: ["Added multiply node", "Verified node creation"],
})
```

## Status update guidance

- Keep messages to about 4 to 10 words.
- Update only when changing phase or when a task finishes a meaningful step.
- Good examples:
  - `"Inspecting graph"`
  - `"Finding output node"`
  - `"Adding variable nodes"`
  - `"Rewiring preview path"`
  - `"Verifying generated code"`
- Avoid noisy or repetitive updates.

## Environment assumptions

- API namespace: `window.shaderGraphAPI`
- Short alias: `window.sg`
- App location: `https://skymen.github.io/construct-shader-graph/`
- The graph has nodes, ports, wires, uniforms, shader settings, preview settings, and camera state.
- The tool compiles one graph to three targets: WebGL 1, WebGL 2, and WebGPU.
- The preview normally uses the `Output` node unless node preview is enabled.

## Safe vs side-effecting calls

Read-only calls:

- `sg.help()`
- `sg.nodes.list()`
- `sg.nodes.get()`
- `sg.nodes.getPorts()`
- `sg.nodeTypes.list()`
- `sg.nodeTypes.get()`
- `sg.ports.get()`
- `sg.ports.listConnections()`
- `sg.wires.get()`
- `sg.wires.getAll()`
- `sg.uniforms.list()`
- `sg.uniforms.get()`
- `sg.shader.getInfo()`
- `sg.shader.getGeneratedCode()`
- `sg.preview.getSettings()`
- `sg.preview.getNodePreview()`
- `sg.preview.getStartupScriptInfo()`
- `sg.camera.getState()`
- `sg.projects.listExamples()`
- `sg.customNodes.list()`
- `sg.customNodes.get()`

Side-effecting calls:

- `sg.nodes.create()`
- `sg.nodes.edit()`
- `sg.nodes.delete()`
- `sg.wires.create()`
- `sg.wires.delete()`
- `sg.uniforms.create()`
- `sg.uniforms.edit()`
- `sg.uniforms.reorder()`
- `sg.uniforms.delete()`
- `sg.shader.updateInfo()`
- `sg.preview.updateSettings()`
- `sg.preview.resetSettings()`
- `sg.preview.setNodePreview()`
- `sg.preview.toggleNodePreview()`
- `sg.preview.screenshot({ download: true })`
- `sg.layout.autoArrange()`
- `sg.camera.center()`
- `sg.camera.zoomToFit()`
- `sg.camera.setPosition()`
- `sg.camera.setZoom()`
- `sg.projects.openExample()`
- `sg.projects.exportAddon()`

## Core graph guidance

### Node and port discipline

- Always inspect ports before creating wires.
- Use explicit port refs: `{ nodeId, kind, index }`.
- Prefer `index` over `name` for automation stability.
- Use `declaredType` and `resolvedType` to understand generic or dynamic nodes.

Port reference examples:

```js
{ nodeId: 12, kind: "input", index: 0 }
{ nodeId: 12, kind: "output", index: 1 }
```

### Variables

Use variable nodes to reduce wire clutter.

- `Set Variable` stores a computed value once.
- `Get Variable` reads it back in multiple places.
- The `Get Variable` output type is inferred from the matching `Set Variable` input.

Preferred rule:

- If one output would feed many distant nodes, prefer a variable instead of many long wires.
- This makes `autoArrange()` cleaner and keeps the graph easier to inspect.

### Existing custom nodes

Existing custom nodes are not an emergency hatch. They are part of the project and can be inspected and used.

- It is safe to inspect existing custom node definitions.
- It is safe to place existing custom nodes in the graph if they already exist in the project.
- Creating a new custom node definition is the advanced escape hatch and should be avoided unless the user explicitly asks for it.
- Prefer built-in nodes first, but if a project already contains a custom node designed for a task, using it is acceptable.

Inspect existing custom nodes with:

```js
sg.customNodes.list()
sg.customNodes.get(3)
sg.customNodes.get("custom_3")
```

When a custom node already exists:

- inspect its ports and code first
- treat it like a project-specific reusable node
- use `sg.nodeTypes.get("custom_<id>")` or `sg.customNodes.get(id)` to understand it before placing or wiring it

Good variable cases:

- reused UV transforms
- reused masks
- reused sampled colors
- reused lighting terms
- any value with 3 or more downstream uses

### Preview

- Default preview compiles from `Output`.
- Node preview compiles from one selected intermediate node instead.
- Use node preview for masks, UVs, gradients, lighting terms, and intermediate color values.
- A node can only be previewed if it resolves to `float`, `vec2`, `vec3`, or `vec4` on one output.

### Renderer guidance

- Normally build one graph and let the tool generate all targets.
- Only branch behavior when absolutely necessary.
- If renderer-specific logic is needed, prefer the shader test node.
- Use preview `shaderLanguage` switching to test generated targets.

## Construct shader guidance

The app is a Construct effect authoring tool, so the AI should understand a few Construct-specific ideas.

- Official docs:
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects`
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgl-shaders`
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgpu-shaders`
  - `https://www.construct.net/en/make-games/manuals/construct-3/project-primitives/objects/effects`
  - `https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/object-interfaces/ieffectinstance`
- Important shader settings include `blendsBackground`, `usesDepth`, `crossSampling`, `animated`, `mustPredraw`, `supports3DDirectRendering`, `extendBoxH`, and `extendBoxV`.
- Background sampling only makes sense when `blendsBackground` is enabled.
- Depth sampling only makes sense when `usesDepth` is enabled.
- Construct uses premultiplied alpha, so many color workflows should use `unpremultiply` before edits and `premultiply` before output.

## Prefer existing Construct helper nodes

Many common Construct shader calculations are already implemented as nodes. Prefer these over rebuilding the math manually.

- Sampling and UV nodes: `frontUV`, `backUV`, `depthUV`, `textureFront`, `textureBack`, `textureDepth`, `samplerFront`, `samplerBack`, `samplerDepth`, `textureSample`, `textureSampleLOD`, `textureSampleGrad`, `texelFetch`
- Built-in Construct values: `builtinSrcStart`, `builtinSrcEnd`, `builtinSrcSize`, `builtinSrcCenter`, `builtinSrcOriginStart`, `builtinSrcOriginEnd`, `builtinSrcOriginSize`, `builtinSrcOriginCenter`, `builtinLayoutStart`, `builtinLayoutEnd`, `builtinLayoutCenter`, `builtinLayoutSize`, `builtinDestStart`, `builtinDestEnd`, `builtinDestCenter`, `builtinDestSize`, `builtinDevicePixelRatio`, `builtinLayerScale`, `builtinLayerAngle`, `builtinSeconds`, `builtinZNear`, `builtinZFar`
- Coordinate helpers: `pixelSize`, `texelSize`, `layoutPixelSize`, `srcOriginToNorm`, `srcToNorm`, `normToSrc`, `normToSrcOrigin`, `srcToDest`, `clampToSrc`, `clampToSrcOrigin`, `clampToDest`, `getLayoutPos`
- Color and depth helpers: `premultiply`, `unpremultiply`, `linearizeDepth`, `normalFromDepth`, `grayscale`, `rgbToHsl`, `hslToRgb`
- Higher-level helpers: `gradientMap`, `blendMode`, `directionalLight`, `rimLight`, `hemisphereLight`, `specularLight`, `matcap`

## Startup script guidance

The startup script is optional and exists only to make preview testing easier.

- Use it for preview interactivity, not shader logic.
- Good uses: camera setup, object rotation, layout tweaks, quick runtime animation.
- Keep it short and preview-focused.
- Do not depend on it for exported shader behavior.

Available startup script variables:

- `runtime`
- `sprite`
- `shape3D`
- `background`
- `background3d`
- `camera`
- `layout`
- `layer`

Construct scripting reference:

- `https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference`

Example:

```js
sg.preview.updateSettings({
  startupScript: `
camera.lookAtPosition(0, 0, 120, 0, 0, 0, 0, 1, 0);
shape3D.angleY += 15;
`,
})
```

## Projects and session workflow

Use the session API for start, progress, and finish.

```js
sg.session.initAIWork({ message: "Inspecting graph" })
sg.session.updateAIWork("Opening example")
sg.session.endAIWork({
  title: "AI task complete",
  summary: ["Loaded example", "Added rim light", "Verified preview"],
})
```

Project rules:

- Use `sg.projects.listExamples()` and `sg.projects.openExample()` for built-in examples.
- Do not assume the AI should open arbitrary local files.
- Do not assume the AI should save project files on its own.
- If the user wants a new project, refresh the page and then close the startup dialog again.
- Use `sg.projects.exportAddon()` when the user wants a downloadable export.

## Recommended task workflows

### Inspect a graph safely

```js
sg.session.initAIWork({ message: "Inspecting graph" })
const nodes = sg.nodes.list()
const wires = sg.wires.getAll()
const uniforms = sg.uniforms.list()
const shaderInfo = sg.shader.getInfo()
sg.session.endAIWork({
  summary: [`Found ${nodes.length} nodes`, `Found ${wires.length} wires`, `Found ${uniforms.length} uniforms`],
})
```

### Create a node and verify it

```js
sg.session.initAIWork({ message: "Adding node" })
const node = sg.nodes.create({ type: "mix", x: 400, y: 200 })
const verified = sg.nodes.get(node.id)
sg.session.endAIWork({ summary: [`Created node ${verified.id}`, `Type ${verified.typeKey}`] })
```

### Connect two nodes correctly

```js
const sourcePorts = sg.nodes.getPorts(1)
const targetPorts = sg.nodes.getPorts(2)

sg.wires.create({
  from: { nodeId: 1, kind: "output", index: 0 },
  to: { nodeId: 2, kind: "input", index: 0 },
})

sg.ports.listConnections({ nodeId: 1, kind: "output", index: 0 })
```

### Use variables instead of fan-out

```js
const setVar = sg.nodes.create({ type: "setVariable", customInput: "baseMask" })
const getVarA = sg.nodes.create({ type: "getVariable", selectedVariable: "baseMask" })
const getVarB = sg.nodes.create({ type: "getVariable", selectedVariable: "baseMask" })
```

### Debug an intermediate value

```js
sg.preview.setNodePreview(12)
sg.preview.updateSettings({ shaderLanguage: "webgpu" })
sg.preview.setNodePreview(null)
```

### Export with version bump

```js
sg.projects.exportAddon({ bumpVersion: "patch" })
```

## Good vs bad behavior

Good:

- Inspect ids before editing.
- Inspect ports before wiring.
- Use `batch()` for a tightly related group of edits.
- Re-read affected nodes and ports after structural changes.
- Prefer helper nodes and variable nodes.
- Reuse an existing custom node when it is clearly the project-specific tool for the job.

Bad:

- Guess node ids from names.
- Rebuild a whole graph for a tiny fix.
- Create many long wires from one output when variables would do.
- Use startup scripts to simulate graph logic.
- Split the graph by renderer without a real need.
- Create new custom nodes casually instead of composing the graph from existing nodes.

## Troubleshooting

- `API unavailable`
  - Check that `window.sg` exists.
  - Refresh the page if the app just loaded incorrectly.
- `Node not found`
  - Re-run `sg.nodes.list()` and resolve the correct id.
- `Wire creation failed`
  - Inspect both nodes with `sg.nodes.getPorts()`.
  - Check port direction and `resolvedType`.
- `Generated code failed`
  - Make sure an `Output` node exists.
  - Re-check required connections.
- `Preview looks wrong`
  - Inspect `sg.preview.getSettings()`.
  - Test node preview on intermediate values.
  - Switch `shaderLanguage` to compare targets.
- `Graph became cluttered`
  - Replace repeated fan-out with `Set Variable` and `Get Variable`.
  - Run `sg.layout.autoArrange()` after structural edits.

## API cheat sheet

### General

```js
sg.help()
sg.batch(label, fn)
```

### Session and projects

```js
sg.session.initAIWork({ message: "Inspecting graph" })
sg.session.updateAIWork("Adding nodes")
sg.session.endAIWork({ title: "AI task complete", summary: ["Done"] })

sg.projects.listExamples()
sg.projects.openExample("example.c3sg")
sg.projects.exportAddon()
sg.projects.exportAddon({ bumpVersion: "patch" })
sg.projects.exportAddon({ version: "1.2.0.0" })

sg.customNodes.list()
sg.customNodes.get(3)
sg.customNodes.get("custom_3")
```

### Nodes

```js
sg.nodes.list()
sg.nodes.get(nodeId)
sg.nodes.getPorts(nodeId)
sg.nodes.search(query)
sg.nodes.create({ type, x, y, select, operation, customInput, selectedVariable, inputValues, gradientStops, patch })
sg.nodes.edit(nodeId, patch)
sg.nodes.delete(nodeId)
```

### Node types

```js
sg.nodeTypes.list()
sg.nodeTypes.list({ availableOnly: true })
sg.nodeTypes.search("depth")
sg.nodeTypes.get("normalFromDepth")
```

### Ports and wires

```js
sg.ports.get({ nodeId: 12, kind: "input", index: 0 })
sg.ports.listConnections({ nodeId: 12, kind: "output", index: 0 })

sg.wires.getAll()
sg.wires.get(wireId)
sg.wires.create({
  from: { nodeId: 4, kind: "output", index: 0 },
  to: { nodeId: 9, kind: "input", index: 1 },
})
sg.wires.delete(wireId)
```

Each serialized port includes:

- `declaredType`
- `resolvedType`
- `isEditable`
- `value`
- `connectionCount`
- `wireIds`

### Uniforms

```js
sg.uniforms.list()
sg.uniforms.get(id)
sg.uniforms.create({ name, description, type, value, isPercent })
sg.uniforms.edit(id, { name, description, value, isPercent })
sg.uniforms.reorder(id, newIndex)
sg.uniforms.delete(id)
```

### Shader

```js
sg.shader.getInfo()
sg.shader.updateInfo({ blendsBackground: true, usesDepth: true })
sg.shader.getGeneratedCode()
```

`sg.shader.getGeneratedCode()` returns:

```js
{
  webgl1: "...",
  webgl2: "...",
  webgpu: "...",
}
```

### Preview

```js
sg.preview.getSettings()
sg.preview.getStartupScriptInfo()
sg.preview.updateSettings({ object: "box", shaderLanguage: "webgpu" })
sg.preview.resetSettings()
sg.preview.getNodePreview()
sg.preview.setNodePreview(nodeId)
sg.preview.toggleNodePreview(nodeId)
sg.preview.screenshot()
sg.preview.screenshot({ download: true })
```

### Layout and camera

```js
sg.layout.autoArrange()
sg.layout.autoArrange({ nodeIds: [1, 2, 3] })

sg.camera.getState()
sg.camera.center()
sg.camera.zoomToFit()
sg.camera.setPosition({ x: 100, y: 50 })
sg.camera.setZoom(1.25)
```
