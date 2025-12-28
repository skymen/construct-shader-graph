import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec4Node = new NodeType(
  "Vec4",
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
    { name: "Z", type: "float" },
    { name: "W", type: "float" },
  ],
  [{ name: "Vec4", type: "vec4" }],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = vec4(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = vec4(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Value",
  ["compose", "construct", "combine", "rgba", "color", "xyzw", "vector"]
);

// Manual documentation
Vec4Node.manual = {
  description:
    "Composes four float values (X, Y, Z, W) into a 4-component vector. Essential for RGBA colors with alpha, homogeneous coordinates, or any data requiring four components.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Press <kbd>4</kbd> and left-click on the canvas to quickly create a Vec4 node.
    </div>
  `,
};
