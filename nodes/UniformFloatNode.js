import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const UniformFloatNode = new NodeType(
  "Uniform Float",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    float ${outputs[0]} = ${uniformName};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    float ${outputs[0]} = ${uniformName};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const uniformName = node.uniformName || "uniform_Unknown";
        return `    var ${outputs[0]}: f32 = shaderParams.${uniformName};`;
      },
    },
  },
  "Input",
  ["uniform", "parameter", "variable", "float"],
  { name: true, ports: false } // Don't translate node name, but translate ports
);
