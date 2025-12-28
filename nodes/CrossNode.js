import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const CrossNode = new NodeType(
  "Cross",
  [
    { name: "A", type: "vec3" },
    { name: "B", type: "vec3" },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.vectorOp,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = cross(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = cross(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = cross(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Vector",
  ["cross product", "perpendicular", "normal"]
);
