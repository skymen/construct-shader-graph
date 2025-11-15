import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const MixNode = new NodeType(
  "Mix",
  [
    { name: "A", type: "T" },
    { name: "B", type: "T" },
    { name: "T", type: "float" },
  ],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = mix(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  }
);
