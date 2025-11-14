# Blueprint Node System

A blueprint-style node editor with multiple node types, typed ports, and wire connections.

## Features

- **Multiple Node Types**: Choose from Math, Vector, Color, Texture Sample, and Output nodes
- **Typed Ports**: Each port has a specific type (Float, Vector, Color, Texture) with color coding
- **Type Validation**: Connections are validated based on port types - incompatible types cannot be connected
- **Drag Nodes**: Click and drag the header of any node to move it around
- **Bidirectional Connections**: Drag from input to output or output to input
- **Wire Rerouting**: Double-click on a wire to add reroute points for custom wire paths
- **Wire Pickup**: Click on an input port with an existing connection to pick up and rewire it
- **Clear Canvas**: Remove all nodes and connections with the "Clear All" button

## How to Use

### Creating Nodes

1. Open `index.html` in a web browser
2. Click any node type button (Math, Vector, Color, etc.) to create that type of node
3. Each node type has different inputs and outputs with specific types

### Connecting Nodes

1. Click on an output port (right side) and drag to an input port (left side)
2. Or click on an input port and drag to an output port
3. Wires are color-coded based on their data type
4. Only compatible types can be connected

### Adjusting Wire Paths

1. Double-click on any wire to create a reroute point
2. Drag the reroute point to adjust the wire's path
3. Right-click on a reroute point to delete it

### Rewiring Connections

1. Click on an input port that already has a connection
2. The existing wire will be picked up
3. Drag to a different output port to reconnect

## Node Types

- **Math**: Performs mathematical operations (Float inputs/outputs)
- **Vector**: Creates 3D vectors from X, Y, Z components
- **Color**: Creates colors from R, G, B components
- **Texture Sample**: Samples a texture at UV coordinates
- **Output**: Final output node for the shader graph

## Port Types

- **Float** (Blue): Single numeric values
- **Vector** (Orange): 3D vectors
- **Color** (Pink): RGB color values
- **Texture** (Green): Texture data
- **Any** (Gray): Accepts any type

## Files

- `index.html` - Main HTML structure
- `style.css` - Styling and layout
- `script.js` - Blueprint system logic and rendering

## Technical Details

- Pure JavaScript with HTML5 Canvas
- No external dependencies
- Object-oriented design with NodeType, Node, Port, Wire, and RerouteNode classes
- Type-safe connection system
- Real-time rendering with mouse interaction
- Extensible node type system
