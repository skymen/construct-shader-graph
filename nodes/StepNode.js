import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const StepNode = new NodeType(
  "Step",
  [
    { name: "Edge", type: "T" },
    { name: "Value", type: "T" },
  ],
  [{ name: "Result", type: "T" }],
  PORT_TYPES.T.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = step(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    ${outputs[0]} = step(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]} = step(${inputs[0]}, ${inputs[1]});`,
    },
  }
);
