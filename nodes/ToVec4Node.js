import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ToVec4Node = new NodeType(
  "To Vec4",
  [{ name: "Value", type: "T" }],
  [{ name: "Result", type: "vec4" }],
  NODE_COLORS.colorVec4,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec4 ${outputs[0]} = vec4(float(${inputs[0]}));`;
          case "vec2":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]}, 0.0, 1.0);`;
          case "vec3":
          case "color":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]}, 1.0);`;
          case "vec4":
            return `    vec4 ${outputs[0]} = ${inputs[0]};`;
          default:
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]});`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec4 ${outputs[0]} = vec4(float(${inputs[0]}));`;
          case "vec2":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]}, 0.0, 1.0);`;
          case "vec3":
          case "color":
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]}, 1.0);`;
          case "vec4":
            return `    vec4 ${outputs[0]} = ${inputs[0]};`;
          default:
            return `    vec4 ${outputs[0]} = vec4(${inputs[0]});`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]});`;
          case "int":
          case "bool":
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(f32(${inputs[0]}));`;
          case "vec2":
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]}, 0.0, 1.0);`;
          case "vec3":
          case "color":
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]}, 1.0);`;
          case "vec4":
            return `    var ${outputs[0]}: vec4<f32> = ${inputs[0]};`;
          default:
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(${inputs[0]});`;
        }
      },
    },
  },
  "Conversion",
  ["cast", "convert", "vector", "type"]
);
