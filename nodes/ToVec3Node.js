import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const ToVec3Node = new NodeType(
  "To Vec3",
  [{ name: "Value", type: "T" }],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec3 ${outputs[0]} = vec3(float(${inputs[0]}));`;
          case "vec2":
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]}, 0.0);`;
          case "vec3":
          case "color":
            return `    vec3 ${outputs[0]} = ${inputs[0]};`;
          case "vec4":
            return `    vec3 ${outputs[0]} = ${inputs[0]}.xyz;`;
          default:
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]});`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]});`;
          case "int":
          case "bool":
            return `    vec3 ${outputs[0]} = vec3(float(${inputs[0]}));`;
          case "vec2":
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]}, 0.0);`;
          case "vec3":
          case "color":
            return `    vec3 ${outputs[0]} = ${inputs[0]};`;
          case "vec4":
            return `    vec3 ${outputs[0]} = ${inputs[0]}.xyz;`;
          default:
            return `    vec3 ${outputs[0]} = vec3(${inputs[0]});`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]});`;
          case "int":
          case "bool":
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(f32(${inputs[0]}));`;
          case "vec2":
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]}, 0.0);`;
          case "vec3":
          case "color":
            return `    var ${outputs[0]}: vec3<f32> = ${inputs[0]};`;
          case "vec4":
            return `    var ${outputs[0]}: vec3<f32> = ${inputs[0]}.xyz;`;
          default:
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]});`;
        }
      },
    },
  },
  "Conversion",
  ["cast", "convert", "vector", "type"]
);
