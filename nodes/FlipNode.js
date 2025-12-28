import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FlipNode = new NodeType(
  "Flip",
  [
    { name: "UV", type: "vec2" },
    { name: "Center", type: "vec2" },
  ],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.uvTransform,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const axis = node.operation || "horizontal";
        if (axis === "horizontal") {
          return `    vec2 ${outputs[0]} = vec2(2.0 * ${inputs[1]}.x - ${inputs[0]}.x, ${inputs[0]}.y);`;
        } else if (axis === "vertical") {
          return `    vec2 ${outputs[0]} = vec2(${inputs[0]}.x, 2.0 * ${inputs[1]}.y - ${inputs[0]}.y);`;
        } else {
          // both
          return `    vec2 ${outputs[0]} = 2.0 * ${inputs[1]} - ${inputs[0]};`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const axis = node.operation || "horizontal";
        if (axis === "horizontal") {
          return `    vec2 ${outputs[0]} = vec2(2.0 * ${inputs[1]}.x - ${inputs[0]}.x, ${inputs[0]}.y);`;
        } else if (axis === "vertical") {
          return `    vec2 ${outputs[0]} = vec2(${inputs[0]}.x, 2.0 * ${inputs[1]}.y - ${inputs[0]}.y);`;
        } else {
          // both
          return `    vec2 ${outputs[0]} = 2.0 * ${inputs[1]} - ${inputs[0]};`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const axis = node.operation || "horizontal";
        if (axis === "horizontal") {
          return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(2.0 * ${inputs[1]}.x - ${inputs[0]}.x, ${inputs[0]}.y);`;
        } else if (axis === "vertical") {
          return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]}.x, 2.0 * ${inputs[1]}.y - ${inputs[0]}.y);`;
        } else {
          // both
          return `    var ${outputs[0]}: vec2<f32> = 2.0 * ${inputs[1]} - ${inputs[0]};`;
        }
      },
    },
  },
  "UV",
  ["flip", "mirror", "reflect", "uv", "horizontal", "vertical"]
);

FlipNode.hasOperation = true;
FlipNode.operationOptions = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "both", label: "Both" },
];
