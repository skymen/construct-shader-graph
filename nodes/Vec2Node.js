import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec2Node = new NodeType(
  "Vec2",
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
  ],
  [{ name: "Vec2", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = vec2(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec2 ${outputs[0]} = vec2(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Value",
  ["compose", "construct", "combine", "2d", "xy", "vector"]
);

// Manual documentation
Vec2Node.manual = {
  description:
    "Composes two float values (X, Y) into a 2-component vector. Useful for creating UV coordinates, 2D positions, or any data that needs two components.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Press <kbd>2</kbd> and left-click on the canvas to quickly create a Vec2 node.
    </div>
  `,
};
