import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ShaderLanguageTestNode = new NodeType(
  "Shader Test",
  [
    { name: "WebGL 1", type: "genType" },
    { name: "WebGL 2", type: "genType" },
    { name: "WebGPU", type: "genType" },
  ],
  [{ name: "Out", type: "genType" }],
  "#8a4fff",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = ${inputs[1]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var shad${outputs[0]} = ${inputs[2]};`,
    },
  },
  "Debug",
  ["shader", "language", "test", "debug", "webgl", "webgpu", "select", "switch"]
);
