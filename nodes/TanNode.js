import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const TanNode = new NodeType(
  "Tan",
  [{ name: "Angle", type: "T" }],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = tan(${inputs[0]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = tan(${inputs[0]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = tan(${inputs[0]});`,
    },
  }
);
