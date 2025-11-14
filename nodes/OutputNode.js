import { NodeType } from "./NodeType.js";

export const OutputNode = new NodeType(
  "Output",
  [
    { name: "Color", type: "color" },
    { name: "Alpha", type: "float" },
  ],
  [],
  "#4a3a3a",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    gl_FragColor = vec4(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    fragColor = vec4(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    return vec4<f32>(${inputs[0]}, ${inputs[1]});`,
    },
  }
);
