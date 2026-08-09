# Construct Shader Graph

A visual node-based shader graph editor that generates shaders for WebGL 1, WebGL 2, and WebGPU.

The version you are running is shown next to the wordmark in the toolbar; click
it, or use **Help > What's New**, for the changelog. See
[CHANGELOG.md](CHANGELOG.md).

## Support the Project

If you find this project useful, consider supporting its development:

[![Donate](https://img.shields.io/badge/Donate-Open%20Collective-blue)](https://opencollective.com/construct-community/projects/shader-graph)

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

This will start Vite's development server and open the application in your browser at `http://localhost:3002`.

### Build

Build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Command Line

`csg` drives the same editor headlessly, so anything it reports is what the app
would report. It is a transport over the app's own API rather than a second
implementation — see [`cli/`](cli/).

```bash
npm run cli -- <command>      # no setup
npm link && csg <command>     # or install `csg` globally
```

| Command | What it does |
|---|---|
| `csg create <f>` | New project file with the default starting nodes. `--name`, `--author`, and every shader setting as a flag. |
| `csg lint <f>` | Readability audit: dead nodes, comment coverage, auto-named variables, unrouted fan-out, wire crossings. |
| `csg validate <f>` | Call-DAG errors, contract errors, lint warnings, codegen check. Exits non-zero on failure. |
| `csg arrange <f>` | Auto-arrange with the app's layout engine. `--all-graphs`, `--in-place`, `-o`. |
| | Follow it with `layout.tidyVariables` and `layout.routeWires` to park variable nodes and route wires around obstacles. |
| `csg codegen <f>` | Generate shader code. `--target`, and `--graph` to emit one function graph's declarations. |
| `csg export <f>` | Build the `.c3addon`. `--bump`, `--version`, `--unpacked`. |
| `csg comment <f>` | Fit a comment around nodes: `--nodes 3,4,5 --title "..."`. |
| `csg preview <f>` | Render the preview to a PNG in a headless browser (needs Playwright). |
| `csg run <s.js> <f>` | Run a script against a live `sg`. `-e` for an inline expression, `--write` to save. |
| `csg repl [f]` | Interactive REPL with `sg`, `blueprint` and `NODE_TYPES` in scope. |
| `csg diff <a> <b>` | Compare two projects by structure and by generated code. |
| `csg paramid <f>` | Check uniform paramIds against a `--baseline` addon or project. |
| `csg api <method>` | Call any API method. `--list` enumerates them. |

Examples:

```bash
csg create shader.c3sg --name "My Effect" --author "Me" --animated
csg validate shader.c3sg --warnings-as-errors     # does it compile?
csg lint shader.c3sg                              # can a human read it?
csg arrange shader.c3sg --all-graphs --in-place
csg codegen shader.c3sg --target webgl1
csg preview shader.c3sg -o shot.png --sprite-texture sprite.png
csg paramid shader.c3sg --baseline published-1.2.0.0.c3addon
csg run -e 'sg.nodes.search({ query: "noise" })' shader.c3sg
```

A few things worth knowing:

- **`csg lint` is not `csg validate`.** `validate` asks whether the shader
  compiles; `lint` asks whether the graph is readable afterwards. Codegen is
  perfectly happy with dead nodes, variables named `math_result`, and wires
  crossing the whole canvas, so none of that shows up in `validate`.

- **Comments survive an arrange.** The layout engine treats a comment as a
  constraint: it lays the members out as a unit, reserves the box's own rect,
  and refits the comment afterwards. So `arrange` and `comment` can run in
  either order. Pass `fitComments: false` to opt out.

- **`csg preview` really compiles the shader.** It runs the Construct 3 runtime
  in headless Chromium, so a compile error on any backend fails the command.
  Nothing else in the CLI can detect that — jsdom has no GPU. Install it with
  `npm install --save-optional playwright && npx playwright install chromium`;
  every other command works without it.
- **`--language webgpu` relaunches the browser.** WebGL runs on ANGLE/SwiftShader,
  but C3 refuses a fallback WebGPU adapter, so SwiftShader is no use there and
  the host switches to installed Chrome (or a windowed Chromium) to get a real
  one. Without that, asking for WebGPU does not fail — it silently renders on
  WebGL2 and reports success, so a WebGPU-only bug looks fixed when it was never
  exercised.
- **`--force-rotated-texture` reproduces rotated spritesheet frames.** C3 packs
  some frames sideways, which turns any texture-UV-to-layout mapping 90 degrees;
  the flag (and the matching preview checkbox) puts every non-tiled image into
  that state so the case is testable. See
  `nodes/GetLayoutPosRotationSafeNode.js`.
- **`csg api --list` is generated from `api.getManifest()`.** A method added to
  `GlobalConsoleApi.js` is reachable from the CLI immediately, with no code
  written in `cli/`.

## Usage

### Creating Nodes

- **Right-click** on the canvas to open the search menu
- Type to filter node types
- Click a node type or press Enter to create it

### Connecting Nodes

- **Drag** from an output port to an input port
- **Drag** from an input port to pick up existing connections
- Compatible port types are highlighted during dragging

### Editing Values

- Click on editable input values (float/int) to edit them directly
- Values are only editable when no wire is connected

### Selection & Manipulation

- **Click** a node to select it
- **Cmd/Ctrl + Click** to multi-select
- **Click and drag** on empty space for box selection
- **Delete/Backspace** to delete selected nodes
- Drag any selected node to move all selected nodes together

### Camera Controls

- **Scroll** to pan the canvas
- **Cmd/Ctrl + Scroll** or **Pinch** to zoom
- **Middle-click + Drag** to pan

### Reroute Nodes

- **Double-click** on a wire to create a reroute node
- **Right-click** a reroute node to delete it

### Exporting Shaders

1. Click the **Export GLSL** button
2. A ZIP file will download containing:
   - `shader-webgl1.frag` - WebGL 1.0 GLSL ES 100
   - `shader-webgl2.frag` - WebGL 2.0 GLSL ES 300
   - `shader-webgpu.wgsl` - WebGPU WGSL

## Project Structure

```
construct-shader-graph/
├── nodes/               # Node type definitions
│   ├── NodeType.js     # Base node type class
│   ├── PortTypes.js    # Port type definitions
│   ├── MathNode.js     # Math operation node
│   ├── VectorNode.js   # Vector construction node
│   ├── ColorNode.js    # Color construction node
│   ├── TextureNode.js  # Texture sampling node
│   ├── OutputNode.js   # Output node
│   ├── *VariableNode.js # Variable nodes
│   └── index.js        # Node type registry
├── shaders/            # Shader boilerplate files
│   ├── boilerplate-webgl1.glsl
│   ├── boilerplate-webgl2.glsl
│   └── boilerplate-webgpu.wgsl
├── index.html          # Main HTML file
├── script.js           # Main application logic
├── style.css           # Styles
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies and scripts
```

## Adding Custom Nodes

To add a new node type:

1. Create a new file in `nodes/` (e.g., `MyNode.js`)
2. Define the node with shader code for all three targets:

```javascript
import { NodeType } from "./NodeType.js";

export const MyNode = new NodeType(
  "My Node",
  [{ name: "Input", type: "float" }],
  [{ name: "Output", type: "float" }],
  "#3a3a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} * 2.0;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    float ${outputs[0]} = ${inputs[0]} * 2.0;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = ${inputs[0]} * 2.0;`,
    },
  }
);
```

3. Export it in `nodes/index.js`:

```javascript
export { MyNode } from "./MyNode.js";

export const NODE_TYPES = {
  // ... existing nodes
  myNode: MyNode,
};
```

## Technologies

- **Vite** - Build tool and dev server
- **JSZip** - ZIP file generation
- **HTML5 Canvas** - Rendering
- **Vanilla JavaScript** - No framework dependencies

## License

MIT
