import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const ColorVariableNode = new NodeType(
  "Color Variable",
  [],
  [{ name: "Value", type: "vec3" }],
  PORT_TYPES.color.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(1.0, 1.0, 1.0);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(1.0, 1.0, 1.0);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);`,
    },
  }
);
