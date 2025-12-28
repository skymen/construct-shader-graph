import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const LuminosityNode = new NodeType(
  "Luminosity",
  [{ name: "Value", type: "genType" }],
  [{ name: "Result", type: "float" }],
  NODE_COLORS.colorAdjust,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    float ${outputs[0]} = ${inputs[0]};`;
          case "vec2":
            return `    float ${outputs[0]} = (${inputs[0]}.x + ${inputs[0]}.y) * 0.5;`;
          case "vec3":
            return `    float ${outputs[0]} = dot(${inputs[0]}, vec3(0.299, 0.587, 0.114));`;
          case "vec4":
            return `    float ${outputs[0]} = dot(${inputs[0]}.rgb, vec3(0.299, 0.587, 0.114)) * ${inputs[0]}.a;`;
          default:
            return `    float ${outputs[0]} = ${inputs[0]};`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    float ${outputs[0]} = ${inputs[0]};`;
          case "vec2":
            return `    float ${outputs[0]} = (${inputs[0]}.x + ${inputs[0]}.y) * 0.5;`;
          case "vec3":
            return `    float ${outputs[0]} = dot(${inputs[0]}, vec3(0.299, 0.587, 0.114));`;
          case "vec4":
            return `    float ${outputs[0]} = dot(${inputs[0]}.rgb, vec3(0.299, 0.587, 0.114)) * ${inputs[0]}.a;`;
          default:
            return `    float ${outputs[0]} = ${inputs[0]};`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const inputType = inputTypes[0];
        switch (inputType) {
          case "float":
            return `    var ${outputs[0]}: f32 = ${inputs[0]};`;
          case "vec2":
            return `    var ${outputs[0]}: f32 = (${inputs[0]}.x + ${inputs[0]}.y) * 0.5;`;
          case "vec3":
            return `    var ${outputs[0]}: f32 = dot(${inputs[0]}, vec3<f32>(0.299, 0.587, 0.114));`;
          case "vec4":
            return `    var ${outputs[0]}: f32 = dot(${inputs[0]}.rgb, vec3<f32>(0.299, 0.587, 0.114)) * ${inputs[0]}.a;`;
          default:
            return `    var ${outputs[0]}: f32 = ${inputs[0]};`;
        }
      },
    },
  },
  "Color",
  ["brightness", "luma", "grayscale", "intensity"]
);

// Manual entry for documentation
LuminosityNode.manual = {
  description:
    "Calculates the perceived brightness (luminosity) of a color using the standard Rec. 601 luma coefficients. For vec4 inputs, the result is multiplied by the alpha channel.",
  html: `
    <h4>Formula</h4>
    <pre><code>Luminosity = 0.299 * R + 0.587 * G + 0.114 * B</code></pre>
    
    <h4>Input Type Behavior</h4>
    <ul>
      <li><strong>float:</strong> Returns the input value unchanged</li>
      <li><strong>vec2:</strong> Returns the average of both components</li>
      <li><strong>vec3:</strong> Returns the luminosity using RGB coefficients</li>
      <li><strong>vec4:</strong> Returns the luminosity multiplied by alpha</li>
    </ul>
    
    <h4>Common Uses</h4>
    <ul>
      <li>Converting color images to grayscale</li>
      <li>Creating luminosity masks for effects</li>
      <li>Brightness-based thresholding</li>
      <li>Edge detection preprocessing</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> The coefficients (0.299, 0.587, 0.114) are based on human perception - we're most sensitive to green, then red, then blue.
    </div>
  `,
};
