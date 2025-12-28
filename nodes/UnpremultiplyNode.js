import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const UnpremultiplyNode = new NodeType(
  "Unpremultiply",
  [{ name: "Color", type: "vec4" }],
  [{ name: "Result", type: "vec4" }],
  NODE_COLORS.colorVec4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = ${inputs[0]};\n` +
        `    if (${outputs[0]}.a != 0.0)\n` +
        `        ${outputs[0]}.rgb /= ${outputs[0]}.a;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec4 ${outputs[0]} = ${inputs[0]};\n` +
        `    if (${outputs[0]}.a != 0.0)\n` +
        `        ${outputs[0]}.rgb /= ${outputs[0]}.a;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec4<f32> = c3_unpremultiply(${inputs[0]});`,
    },
  },
  "Color",
  ["alpha", "premultiply", "blend", "color"]
);
