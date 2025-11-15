import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const SmoothstepNode = new NodeType(
  "Smoothstep",
  [
    { name: "Edge0", type: "T" },
    { name: "Edge1", type: "T" },
    { name: "Value", type: "T" },
  ],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = smoothstep(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`,
    },
  }
);
