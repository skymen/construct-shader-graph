## What's Being Tested

This build includes the new **Functions and Loop Bodies** system — a complete rewrite of the subgraph feature from the previous experimental build.

### Subgraphs (Functions & Loop Bodies)

- Full function subgraph support with custom inputs/outputs
- Loop body subgraphs with iteration support
- Generic type propagation across function boundaries (genType cascading)
- "Turn Into Function" — select nodes and convert them into a reusable function
- Button on subgraph nodes to open and edit the subgraph
- Code generation for functions and loops across all targets (WebGL1, WebGL2, WebGPU)
- Copy/paste support for subgraph nodes
- Undo/redo support with proper shader updates on undo/redo
- Centering view on newly created function/loop body

### UX Improvements

- Double click on a comment to edit it
- Comment text is now always visible
- Manual entries for Swizzle and Type nodes
- Button on nodes that links to the manual
- Fixed bug with float input shortcut

## Important Notes

- This build may be unstable
- Your work may not be compatible with the stable version
- Features may change or be removed without notice

## Feedback

If you encounter any issues or have suggestions, please report them on the GitHub repository or on the Discord server
