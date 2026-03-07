# Construct Shader Graph Console Skill

Use `window.shaderGraphAPI` or the short alias `window.sg` from the browser console to inspect and control the editor.

## Quick start

```js
sg.help()
sg.nodeTypes.list()
sg.nodes.list()
sg.shader.getGeneratedCode()
sg.preview.getSettings()
```

## Core model

- The graph is made of nodes, ports, wires, uniforms, shader settings, preview settings, camera state, and an optional node preview target.
- The tool already generates WebGL 1, WebGL 2, and WebGPU shader code from the same graph. Most of the time you should build one renderer-agnostic graph and let the tool generate all targets.
- Only branch renderer behavior when necessary. If you need renderer-specific logic, prefer the shader test node instead of manually forking the whole graph.
- The preview normally compiles the graph from the `Output` node. If node preview is enabled, the preview compiles from that node instead.

## Construct effect context

Construct effects are renderer-backed shaders with effect metadata that controls how they can be used.

- Official docs:
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects`
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgl-shaders`
  - `https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgpu-shaders`
  - `https://www.construct.net/en/make-games/manuals/construct-3/project-primitives/objects/effects`
  - `https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/object-interfaces/ieffectinstance`
- Important shader settings exposed by this tool include `blendsBackground`, `usesDepth`, `crossSampling`, `animated`, `mustPredraw`, `supports3DDirectRendering`, `extendBoxH`, and `extendBoxV`.
- Background sampling only makes sense when `blendsBackground` is enabled.
- Depth sampling only makes sense when `usesDepth` is enabled.
- Construct uses premultiplied alpha, so for many color operations you should unpremultiply, edit, then premultiply again.

## Construct helper nodes already implemented

Many of the common calculations from Construct shader docs already exist as nodes. Prefer these over rebuilding the math manually.

- Sampling and UV nodes: `frontUV`, `backUV`, `depthUV`, `textureFront`, `textureBack`, `textureDepth`, `samplerFront`, `samplerBack`, `samplerDepth`, `textureSample`, `textureSampleLOD`, `textureSampleGrad`, `texelFetch`
- Built-in Construct values: `builtinSrcStart`, `builtinSrcEnd`, `builtinSrcSize`, `builtinSrcCenter`, `builtinSrcOriginStart`, `builtinSrcOriginEnd`, `builtinSrcOriginSize`, `builtinSrcOriginCenter`, `builtinLayoutStart`, `builtinLayoutEnd`, `builtinLayoutCenter`, `builtinLayoutSize`, `builtinDestStart`, `builtinDestEnd`, `builtinDestCenter`, `builtinDestSize`, `builtinDevicePixelRatio`, `builtinLayerScale`, `builtinLayerAngle`, `builtinSeconds`, `builtinZNear`, `builtinZFar`
- Coordinate helpers: `pixelSize`, `texelSize`, `layoutPixelSize`, `srcOriginToNorm`, `srcToNorm`, `normToSrc`, `normToSrcOrigin`, `srcToDest`, `clampToSrc`, `clampToSrcOrigin`, `clampToDest`, `getLayoutPos`
- Color/depth helpers: `premultiply`, `unpremultiply`, `linearizeDepth`, `normalFromDepth`, `grayscale`, `rgbToHsl`, `hslToRgb`
- Higher-level effect helpers: `gradientMap`, `blendMode`, `directionalLight`, `rimLight`, `hemisphereLight`, `specularLight`, `matcap`

## Variable nodes

Use variable nodes to keep the graph clean.

- `Set Variable` stores a value under a custom variable name.
- `Get Variable` reads the named value later.
- The `Get Variable` output type is dynamic and matches the connected `Set Variable` input type.
- Prefer variables when one computed value is reused in multiple places.

Recommended guideline:

- Avoid creating many long wires from the same output port.
- Instead, compute once, store with `Set Variable`, and read the value back with multiple `Get Variable` nodes.
- This makes auto-arrange much cleaner and keeps the graph readable.

Good uses for variables:

- reused UV transforms
- reused masks or noise values
- reused sampled colors
- reused lighting terms
- any value used by 3 or more downstream nodes

## Preview model

The preview is a live Construct sandbox running in an iframe.

- By default it previews the effect generated from the `Output` node.
- When node preview is enabled, it previews from the selected node instead of the `Output` node.
- Node preview works best for debugging masks, gradients, noise, UVs, lighting terms, and intermediate color values.
- Preview settings control the scene, renderer target, object type, camera mode, scales, background visibility, and more.

### Preview settings

You can read and edit the basic preview settings with:

```js
sg.preview.getSettings()
sg.preview.updateSettings({ shaderLanguage: "webgl2", cameraMode: "perspective" })
sg.preview.resetSettings()
sg.preview.getStartupScriptInfo()
```

Supported settings:

- `effectTarget`
- `object`
- `cameraMode`
- `autoRotate`
- `samplingMode`
- `shaderLanguage`
- `spriteTextureUrl`
- `shapeTextureUrl`
- `bgTextureUrl`
- `showBackgroundCube`
- `spriteScale`
- `shapeScale`
- `roomScale`
- `bgOpacity`
- `bg3dOpacity`
- `zoomLevel`
- `startupScript`

Notes:

- `shaderLanguage` and `samplingMode` reload the preview.
- Most other settings update live.
- Use `shaderLanguage` for testing generated targets, not as a reason to split the graph unless needed.

### Node preview

```js
sg.preview.getNodePreview()
sg.preview.setNodePreview(42)
sg.preview.setNodePreview(null)
sg.preview.toggleNodePreview(42)
```

- A node can only be previewed if it has an output resolving to `float`, `vec2`, `vec3`, or `vec4`.
- Use this to inspect intermediate values before they reach the final `Output` node.

## Startup script

The startup script is optional and exists to make previewing more interactive.

- Use it when an effect needs motion, camera control, object changes, or runtime tweaks to be easy to evaluate in preview.
- The script runs inside the preview iframe after the Construct preview scene is ready.
- It is not part of the shader graph itself; it is only a preview helper.

You can read or edit it with preview settings:

```js
sg.preview.updateSettings({
  startupScript: `
camera.lookAtPosition(0, 0, 120, 0, 0, 0, 0, 1, 0);
shape3D.angleY += 15;
`
})
```

Variables available to the startup script:

- `runtime`
- `sprite`
- `shape3D`
- `background`
- `background3d`
- `camera`
- `layout`
- `layer`

These come from the preview runtime and are passed directly into the startup script function.

Use the Construct scripting reference to understand what those objects expose:

- `https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference`

Practical uses:

- move or rotate the 3D preview object
- reposition the camera
- tweak layout/layer state for testing
- build simple interactive preview setups

Guidelines:

- keep startup scripts short and preview-focused
- do not rely on them as part of the exported effect logic
- prefer the graph for visual logic and the startup script only for preview interactivity

## API reference

### General

```js
sg.help()
sg.batch(label, fn)
```

- `batch()` groups multiple graph edits into one undo history entry.

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

`nodes.get()` returns a serialized node snapshot including port info.

Useful editable node patch fields:

- `x`, `y`, or `position`
- `operation`
- `customInput`
- `selectedVariable`
- `data`
- `gradientStops`
- `inputValues`

### Node types

```js
sg.nodeTypes.list()
sg.nodeTypes.list({ availableOnly: true })
sg.nodeTypes.search("depth")
sg.nodeTypes.get("normalFromDepth")
```

- `nodeTypes.get()` includes the node manual entry when it exists.

### Ports

Port references use this form:

```js
{ nodeId: 12, kind: "input", index: 0 }
{ nodeId: 12, kind: "output", index: 1 }
```

You can also use `name` instead of `index`, but `index` is the more stable automation path.

```js
sg.ports.get({ nodeId: 12, kind: "input", index: 0 })
sg.ports.listConnections({ nodeId: 12, kind: "output", index: 0 })
```

Each serialized port includes:

- `declaredType` - original type from the node definition
- `resolvedType` - actual current type after generic/custom resolution
- `isEditable`
- `value`
- `connectionCount`
- `wireIds`

### Wires

```js
sg.wires.getAll()
sg.wires.get(wireId)
sg.wires.create({
  from: { nodeId: 4, kind: "output", index: 0 },
  to: { nodeId: 9, kind: "input", index: 1 },
})
sg.wires.delete(wireId)
```

- Create wires using explicit port refs so the connection target is unambiguous.
- The API checks port compatibility before connecting.
- If the destination input already has a wire, it is replaced.

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

`getGeneratedCode()` returns:

```js
{
  webgl1: "...",
  webgl2: "...",
  webgpu: "..."
}
```

### Preview

```js
sg.preview.getSettings()
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

## Common workflows

### Inspect available node types

```js
sg.nodeTypes.search("depth")
```

### Create a node and inspect its ports

```js
const node = sg.nodes.create({ type: "mix", x: 400, y: 200, select: true });
sg.nodes.getPorts(node.id)
```

### Connect two nodes

```js
sg.wires.create({
  from: { nodeId: 1, kind: "output", index: 0 },
  to: { nodeId: 2, kind: "input", index: 0 },
})
```

### Use variables to reduce wire clutter

```js
const setVar = sg.nodes.create({ type: "setVariable", customInput: "baseMask" });
const getVarA = sg.nodes.create({ type: "getVariable", selectedVariable: "baseMask" });
const getVarB = sg.nodes.create({ type: "getVariable", selectedVariable: "baseMask" });
```

### Preview an intermediate node

```js
sg.preview.setNodePreview(12)
sg.preview.setNodePreview(null)
```

### Test generated code across targets

```js
sg.shader.getGeneratedCode()
sg.preview.updateSettings({ shaderLanguage: "webgl1" })
sg.preview.updateSettings({ shaderLanguage: "webgl2" })
sg.preview.updateSettings({ shaderLanguage: "webgpu" })
```

## Best practices for AI use

- Start by inspecting `nodeTypes.list()` and `nodes.list()`.
- Prefer existing Construct helper nodes instead of rebuilding standard shader math.
- Use variables instead of heavy fan-out from one output.
- Use `nodes.getPorts()` before wiring so `from` and `to` are explicit.
- Check both `declaredType` and `resolvedType` when working with generic or variable-driven nodes.
- Use node preview to debug intermediate values.
- Use the startup script only to make preview testing easier, not to replace graph logic.
