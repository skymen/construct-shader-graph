import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const Vec3Node = new NodeType(
  "Vec3",
  [
    { name: "X", type: "float" },
    { name: "Y", type: "float" },
    { name: "Z", type: "float" },
  ],
  [{ name: "Vec3", type: "vec3" }],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  },
  "Value",
  ["compose", "construct", "combine", "3d", "rgb", "xyz", "vector"]
);

// Manual documentation
Vec3Node.manual = {
  description:
    "Composes three float values (X, Y, Z) into a 3-component vector. Commonly used for RGB colors, 3D positions, normals, or any data requiring three components.",
  html: `
    <div class="tip">
      <strong>Tip:</strong> Press <kbd>3</kbd> and left-click on the canvas to quickly create a Vec3 node.
    </div>
  `,
};
