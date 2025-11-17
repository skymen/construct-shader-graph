# Variable System Implementation

This document describes the implementation of the variable system for the shader graph, which allows you to define and reuse variables across your shader graph.

## Overview

The variable system consists of two special nodes:

1. **Set Variable** - Defines a variable with a name and value
2. **Get Variable** - Retrieves a previously defined variable

## Features

### Set Variable Node

- **Input**: A generic input of type `T` (can be float, int, boolean, vec2, vec3, vec4, or color)
- **Variable Name Field**: A text input where you specify the variable name
- **Validation**: Variable names must be valid identifiers (letters, numbers, underscore) and cannot be reserved keywords
- **Shader Code**: Generates a variable declaration in the shader with the specified name and type

Example shader code generated (note the `temp_` prefix to avoid naming conflicts):

```glsl
float temp_myVariable = 1.5;
vec3 temp_myColor = vec3(1.0, 0.0, 0.0);
```

### Get Variable Node

- **Output**: A dynamic output whose type matches the corresponding Set Variable node
- **Variable Dropdown**: A dropdown menu showing all defined variables
- **Type Resolution**: Automatically resolves the output type based on the selected variable
- **Shader Code**: References the variable by name

Example shader code generated (references use the same `temp_` prefix):

```glsl
float var_0 = temp_myVariable;
vec3 var_1 = temp_myColor;
```

## Dependency Graph Integration

The variable system is fully integrated with the shader's dependency graph:

- **Automatic Dependencies**: Get Variable nodes automatically depend on their corresponding Set Variable nodes
- **Execution Order**: Set Variable nodes are guaranteed to execute before Get Variable nodes that reference them
- **Type Safety**: The type system ensures type compatibility between Set and Get Variable nodes

## Implementation Details

### Files Created

1. **`nodes/SetVariableNode.js`** - Defines the Set Variable node type
2. **`nodes/GetVariableNode.js`** - Defines the Get Variable node type

### Files Modified

1. **`nodes/index.js`** - Added imports and exports for the new node types
2. **`script.js`** - Added extensive support for variable nodes:
   - Node initialization for variable dropdown
   - Height calculation for variable dropdown UI
   - Variable dropdown bounds calculation
   - Variable dropdown rendering
   - Variable dropdown click handling
   - Variable selection menu
   - Dependency graph modification to recognize variable dependencies
   - Blueprint system reference storage for type resolution
   - Serialization/deserialization support for `selectedVariable`
   - Port position calculation updates

### Key Implementation Points

#### Type Resolution

Get Variable nodes use a custom type system that dynamically resolves the output type:

```javascript
GetVariableNode.getCustomType = (node, port) => {
  // Find the corresponding Set Variable node
  const setVarNode = blueprintSystem.nodes.find(
    (n) =>
      n.nodeType.name === "Set Variable" &&
      n.customInput === node.selectedVariable
  );

  // Return the resolved type from the Set Variable's input
  return setVarNode.inputPorts[0].getResolvedType();
};
```

#### Dependency Graph

The dependency graph builder was modified to recognize variable dependencies:

```javascript
// Special handling for Get Variable nodes
if (node.nodeType.name === "Get Variable" && node.selectedVariable) {
  const setVarNode = this.nodes.find(
    (n) =>
      n.nodeType.name === "Set Variable" &&
      n.customInput === node.selectedVariable
  );

  if (setVarNode) {
    nodeDeps.add(setVarNode);
    // Add to queue for traversal...
  }
}
```

#### UI Components

The variable dropdown UI includes:

- Label showing "Variable"
- Dropdown showing selected variable or "(none)"
- Dropdown arrow indicator
- Menu with all available variables
- "(none)" option to clear selection
- Hover effects and visual feedback

## Usage

### Creating a Variable

1. Add a **Set Variable** node to your graph
2. Click on the variable name field and enter a name (e.g., "myValue")
3. Connect an input to the Value port or set a default value
4. The variable is now defined and available

### Using a Variable

1. Add a **Get Variable** node to your graph
2. Click on the variable dropdown
3. Select the variable you want to use from the list
4. The output type will automatically match the variable's type
5. Connect the output to other nodes

### Example Use Case

Variables are useful for:

- **Reusing calculations**: Calculate a value once and use it multiple times
- **Organizing complex graphs**: Name important intermediate values
- **Avoiding duplicate nodes**: Instead of duplicating a chain of nodes, store the result in a variable
- **Improving readability**: Give meaningful names to important values

Example graph:

```
[UV Input] → [Noise] → [Set Variable: "noiseValue"]
                            ↓
[Get Variable: "noiseValue"] → [Math: *2] → [Output]
                            ↓
[Get Variable: "noiseValue"] → [Math: +0.5] → [Another Output]
```

## Technical Notes

### Shader Code Generation

- **Set Variable**: Generates a typed variable declaration with a `temp_` prefix to avoid naming conflicts
- **Get Variable**: Generates a typed variable assignment that references the Set Variable's name (with `temp_` prefix)
- **WebGPU Support**: Automatically converts types to WGSL format (f32, vec2<f32>, etc.)
- **Name Prefixing**: All variable names are automatically prefixed with `temp_` in the generated shader code to prevent conflicts with built-in shader variables and reserved keywords. This prefix is hidden from the user in the UI.

### Type Safety

- Variables maintain type information through the dependency graph
- Type mismatches are prevented by the connection system
- Generic types (T) are resolved at connection time

### Serialization

Variable nodes are fully serializable:

- Set Variable nodes save their `customInput` (variable name)
- Get Variable nodes save their `selectedVariable` (selected variable name)
- Both are restored when loading saved graphs

## Future Enhancements

Potential improvements for the variable system:

1. **Variable Scoping**: Support for local vs global variables
2. **Variable Inspector**: A panel showing all defined variables and their types
3. **Variable Renaming**: Ability to rename variables and update all references
4. **Variable Colors**: Color-code variables for easier identification
5. **Variable Comments**: Add descriptions to variables
6. **Unused Variable Warnings**: Highlight variables that are defined but never used
