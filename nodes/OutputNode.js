import { NodeType } from "./NodeType.js";

export const OutputNode = new NodeType(
  "Output",
  [{ name: "Color", type: "vec4" }],
  [],
  "#4a3a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    gl_FragColor = ${inputs[0]};`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    fragColor = ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) => `    output.color = ${inputs[0]};`,
    },
  }
);
