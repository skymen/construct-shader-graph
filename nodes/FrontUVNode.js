import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const FrontUVNode = new NodeType(
  "Front UV",
  [],
  [{ name: "UV", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = vTex;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    ${outputs[0]} = vTex;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = input.fragUV;`,
    },
  }
);
