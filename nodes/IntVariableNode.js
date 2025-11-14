import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const IntVariableNode = new NodeType(
  "Int Variable",
  [],
  [{ name: "Value", type: "int" }],
  PORT_TYPES.int.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0;
        return `    int ${outputs[0]} = ${value};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0;
        return `    int ${outputs[0]} = ${value};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const value = node.outputPorts[0].value || 0;
        return `    var ${outputs[0]}: i32 = ${value};`;
      },
    },
  }
);
