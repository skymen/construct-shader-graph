import { NodeType } from "./NodeType.js";

export const UniformFloatNode = new NodeType(
  "Uniform Float",
  [],
  [{ name: "Value", type: "float" }],
  "#4a90e2",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uUnknown";
        return `    float ${outputs[0]} = ${uniformName};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uUnknown";
        return `    float ${outputs[0]} = ${uniformName};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uUnknown";
        return `    var ${outputs[0]}: f32 = uniforms.${uniformName};`;
      },
    },
  }
);
