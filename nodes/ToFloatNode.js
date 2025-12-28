import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ToFloatNode = new NodeType(
  "To Float",
  [{ name: "Value", type: "T" }],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    float ${outputs[0]} = ${inputs[0]};`;
          case "int":
          case "bool":
            return `    float ${outputs[0]} = float(${inputs[0]});`;
          case "vec2":
          case "vec3":
          case "vec4":
          case "color":
            return `    float ${outputs[0]} = ${inputs[0]}.x;`;
          default:
            return `    float ${outputs[0]} = float(${inputs[0]});`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    float ${outputs[0]} = ${inputs[0]};`;
          case "int":
          case "bool":
            return `    float ${outputs[0]} = float(${inputs[0]});`;
          case "vec2":
          case "vec3":
          case "vec4":
          case "color":
            return `    float ${outputs[0]} = ${inputs[0]}.x;`;
          default:
            return `    float ${outputs[0]} = float(${inputs[0]});`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    var ${outputs[0]}: f32 = ${inputs[0]};`;
          case "int":
          case "bool":
            return `    var ${outputs[0]}: f32 = f32(${inputs[0]});`;
          case "vec2":
          case "vec3":
          case "vec4":
          case "color":
            return `    var ${outputs[0]}: f32 = ${inputs[0]}.x;`;
          default:
            return `    var ${outputs[0]}: f32 = f32(${inputs[0]});`;
        }
      },
    },
  },
  "Conversion",
  ["cast", "convert", "int to float", "type"]
);
