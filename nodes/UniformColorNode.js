import { NodeType } from "./NodeType.js";

export const UniformColorNode = new NodeType(
  "Uniform Color",
  [],
  [{ name: "Color", type: "vec3" }],
  "#e24a90",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    vec3 ${outputs[0]} = ${uniformName};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    vec3 ${outputs[0]} = ${uniformName};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    var ${outputs[0]}: vec3<f32> = shaderParams.${uniformName};`;
      },
    },
  },
  "Input",
  ["uniform", "parameter", "variable", "color", "rgb"],
  { name: true, ports: false } // Don't translate node name, but translate ports
);
