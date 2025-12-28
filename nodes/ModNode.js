import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

export const ModNode = new NodeType(
  "Mod",
  [
    { name: "A", type: "genType" },
    { name: "B", type: "genType" },
  ],
  [{ name: "Result", type: "genType" }],
  NODE_COLORS.math,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "floor";
        if (op === "truncate") {
          return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} - ${inputs[1]} * trunc(${inputs[0]} / ${inputs[1]});`;
        }
        return `    ${outputTypes[0]} ${outputs[0]} = mod(${inputs[0]}, ${inputs[1]});`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "floor";
        if (op === "truncate") {
          return `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]} - ${inputs[1]} * trunc(${inputs[0]} / ${inputs[1]});`;
        }
        return `    ${outputTypes[0]} ${outputs[0]} = mod(${inputs[0]}, ${inputs[1]});`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const op = node.operation || "floor";
        const wgslType = toWGSLType(outputTypes[0]);
        if (op === "truncate") {
          return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} % ${inputs[1]};`;
        }
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[0]} - ${inputs[1]} * floor(${inputs[0]} / ${inputs[1]});`;
      },
    },
  },
  "Math",
  ["modulo", "remainder", "%", "wrap", "fmod", "modf", "modulus"]
);

ModNode.hasOperation = true;
ModNode.operationOptions = [
  { value: "floor", label: "Floor" },
  { value: "truncate", label: "Truncate" },
];
