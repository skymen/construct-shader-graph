import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const FloatVariableNode = new NodeType(
  "Float Variable",
  [],
  [{ name: "Value", type: "float" }],
  PORT_TYPES.float.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0.0;
        return `    float ${outputs[0]} = ${value.toFixed(2)};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0.0;
        return `    float ${outputs[0]} = ${value.toFixed(2)};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0.0;
        return `    var ${outputs[0]}: f32 = ${value.toFixed(2)};`;
      },
    },
  }
);
