import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ToVec2Node = new NodeType(
  "To Vec2",
  [{ name: "Value", type: "T" }],
  [{ name: "Result", type: "vec2" }],
  NODE_COLORS.colorVec2,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec2 ${outputs[0]} = vec2(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec2 ${outputs[0]} = vec2(float(${inputs[0]}));`;
          case "vec2":
            return `    vec2 ${outputs[0]} = ${inputs[0]};`;
          case "vec3":
          case "vec4":
          case "color":
            return `    vec2 ${outputs[0]} = ${inputs[0]}.xy;`;
          default:
            return `    vec2 ${outputs[0]} = vec2(${inputs[0]});`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec2 ${outputs[0]} = vec2(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec2 ${outputs[0]} = vec2(float(${inputs[0]}));`;
          case "vec2":
            return `    vec2 ${outputs[0]} = ${inputs[0]};`;
          case "vec3":
          case "vec4":
          case "color":
            return `    vec2 ${outputs[0]} = ${inputs[0]}.xy;`;
          default:
            return `    vec2 ${outputs[0]} = vec2(${inputs[0]});`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]});`;
          case "int":
          case "bool":
            return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(f32(${inputs[0]}));`;
          case "vec2":
            return `    var ${outputs[0]}: vec2<f32> = ${inputs[0]};`;
          case "vec3":
          case "vec4":
          case "color":
            return `    var ${outputs[0]}: vec2<f32> = ${inputs[0]}.xy;`;
          default:
            return `    var ${outputs[0]}: vec2<f32> = vec2<f32>(${inputs[0]});`;
        }
      },
    },
  },
  "Conversion",
  ["cast", "convert", "vector", "type"]
);
