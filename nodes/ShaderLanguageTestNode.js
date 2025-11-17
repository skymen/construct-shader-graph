import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const ShaderLanguageTestNode = new NodeType(
  "Shader Test",
  [
    { name: "WebGL 1", type: "T" },
    { name: "WebGL 2", type: "T" },
    { name: "WebGPU", type: "T" },
  ],
  [{ name: "Out", type: "T" }],
  "#8a4fff",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const wgslType = toWGSLType(outputTypes[0]);
        return `    var ${outputs[0]}: ${wgslType} = ${inputs[2]};`;
      },
    },
  },
  "Debug",
  ["shader", "language", "test", "debug", "webgl", "webgpu", "select", "switch"]
);
