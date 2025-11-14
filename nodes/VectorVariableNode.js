import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const VectorVariableNode = new NodeType(
  "Vector Variable",
  [],
  [{ name: "Value", type: "vector" }],
  PORT_TYPES.vector.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(0.0, 0.0, 0.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(0.0, 0.0, 0.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);`,
    },
  }
);
