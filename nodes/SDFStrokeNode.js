import { NodeType } from "./NodeType.js";

export const SDFStrokeNode = new NodeType(
  "SDF Stroke",
  [
    { name: "SDF", type: "float" },
    { name: "Width", type: "float" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Mask", type: "float" }],
  "#6e4a2d",
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => {
        const hw = `(${inputs[1]} * 0.5)`;
        return `    float ${outputs[0]} = 1.0 - smoothstep(${hw} - ${inputs[2]}, ${hw} + ${inputs[2]}, abs(${inputs[0]}));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => {
        const hw = `(${inputs[1]} * 0.5)`;
        return `    float ${outputs[0]} = 1.0 - smoothstep(${hw} - ${inputs[2]}, ${hw} + ${inputs[2]}, abs(${inputs[0]}));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) => {
        const hw = `(${inputs[1]} * 0.5)`;
        return `    var ${outputs[0]}: f32 = 1.0 - smoothstep(${hw} - ${inputs[2]}, ${hw} + ${inputs[2]}, abs(${inputs[0]}));`;
      },
    },
  },
  "SDF",
  ["sdf", "stroke", "outline", "border", "line", "mask", "output"]
);
