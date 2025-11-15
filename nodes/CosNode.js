import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const CosNode = new NodeType(
  "Cos",
  [{ name: "Angle", type: "T" }],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = cos(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = cos(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = cos(${inputs[0]});`,
    },
  }
);
