import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const SDFStrokeNode = new NodeType(
  "SDF Stroke",
  [
    { name: "SDF", type: "float" },
    { name: "Width", type: "float" },
    { name: "Feather", type: "float" },
  ],
  [{ name: "Mask", type: "float" }],
  NODE_COLORS.sdfOutput,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    float hw_${outputs[0]} = ${inputs[1]} * 0.5;
    float feather_${outputs[0]} = max(${inputs[2]}, 0.0001);
    float ${outputs[0]} = 1.0 - smoothstep(hw_${outputs[0]} - feather_${outputs[0]}, hw_${outputs[0]} + feather_${outputs[0]}, abs(${inputs[0]}));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    float hw_${outputs[0]} = ${inputs[1]} * 0.5;
    float feather_${outputs[0]} = max(${inputs[2]}, 0.0001);
    float ${outputs[0]} = 1.0 - smoothstep(hw_${outputs[0]} - feather_${outputs[0]}, hw_${outputs[0]} + feather_${outputs[0]}, abs(${inputs[0]}));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    var hw_${outputs[0]}: f32 = ${inputs[1]} * 0.5;
    var feather_${outputs[0]}: f32 = max(${inputs[2]}, 0.0001);
    var ${outputs[0]}: f32 = 1.0 - smoothstep(hw_${outputs[0]} - feather_${outputs[0]}, hw_${outputs[0]} + feather_${outputs[0]}, abs(${inputs[0]}));`;
      },
    },
  },
  "SDF",
  ["sdf", "stroke", "outline", "border", "line", "mask", "output"]
);
