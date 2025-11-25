import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BlendModeNode = new NodeType(
  "Blend Mode",
  [
    { name: "Base", type: "vec3" },
    { name: "Blend", type: "vec3" },
  ],
  [{ name: "Result", type: "vec3" }],
  PORT_TYPES.vec3.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "normal";
        const base = inputs[0];
        const blend = inputs[1];

        switch (mode) {
          case "normal":
            return `    vec3 ${outputs[0]} = ${blend};`;

          case "multiply":
            return `    vec3 ${outputs[0]} = ${base} * ${blend};`;

          case "screen":
            return `    vec3 ${outputs[0]} = vec3(1.0) - (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend});`;

          case "overlay":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend}, vec3(1.0) - 2.0 * (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend}), step(0.5, ${base}));`;

          case "add":
            return `    vec3 ${outputs[0]} = min(${base} + ${blend}, vec3(1.0));`;

          case "subtract":
            return `    vec3 ${outputs[0]} = max(${base} - ${blend}, vec3(0.0));`;

          case "difference":
            return `    vec3 ${outputs[0]} = abs(${base} - ${blend});`;

          case "darken":
            return `    vec3 ${outputs[0]} = min(${base}, ${blend});`;

          case "lighten":
            return `    vec3 ${outputs[0]} = max(${base}, ${blend});`;

          case "colorDodge":
            return `    vec3 ${outputs[0]} = ${base} / (vec3(1.0) - ${blend} + 0.000001);`;

          case "colorBurn":
            return `    vec3 ${outputs[0]} = vec3(1.0) - (vec3(1.0) - ${base}) / (${blend} + 0.000001);`;

          case "hardLight":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend}, vec3(1.0) - 2.0 * (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "softLight":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend} + ${base} * ${base} * (vec3(1.0) - 2.0 * ${blend}), sqrt(${base}) * (2.0 * ${blend} - vec3(1.0)) + 2.0 * ${base} * (vec3(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "linearDodge":
            return `    vec3 ${outputs[0]} = min(${base} + ${blend}, vec3(1.0));`;

          case "linearBurn":
            return `    vec3 ${outputs[0]} = max(${base} + ${blend} - vec3(1.0), vec3(0.0));`;

          case "exclusion":
            return `    vec3 ${outputs[0]} = ${base} + ${blend} - 2.0 * ${base} * ${blend};`;

          case "divide":
            return `    vec3 ${outputs[0]} = ${base} / (${blend} + 0.000001);`;

          default:
            return `    vec3 ${outputs[0]} = ${blend};`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "normal";
        const base = inputs[0];
        const blend = inputs[1];

        switch (mode) {
          case "normal":
            return `    vec3 ${outputs[0]} = ${blend};`;

          case "multiply":
            return `    vec3 ${outputs[0]} = ${base} * ${blend};`;

          case "screen":
            return `    vec3 ${outputs[0]} = vec3(1.0) - (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend});`;

          case "overlay":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend}, vec3(1.0) - 2.0 * (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend}), step(0.5, ${base}));`;

          case "add":
            return `    vec3 ${outputs[0]} = min(${base} + ${blend}, vec3(1.0));`;

          case "subtract":
            return `    vec3 ${outputs[0]} = max(${base} - ${blend}, vec3(0.0));`;

          case "difference":
            return `    vec3 ${outputs[0]} = abs(${base} - ${blend});`;

          case "darken":
            return `    vec3 ${outputs[0]} = min(${base}, ${blend});`;

          case "lighten":
            return `    vec3 ${outputs[0]} = max(${base}, ${blend});`;

          case "colorDodge":
            return `    vec3 ${outputs[0]} = ${base} / (vec3(1.0) - ${blend} + 0.000001);`;

          case "colorBurn":
            return `    vec3 ${outputs[0]} = vec3(1.0) - (vec3(1.0) - ${base}) / (${blend} + 0.000001);`;

          case "hardLight":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend}, vec3(1.0) - 2.0 * (vec3(1.0) - ${base}) * (vec3(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "softLight":
            return `    vec3 ${outputs[0]} = mix(2.0 * ${base} * ${blend} + ${base} * ${base} * (vec3(1.0) - 2.0 * ${blend}), sqrt(${base}) * (2.0 * ${blend} - vec3(1.0)) + 2.0 * ${base} * (vec3(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "linearDodge":
            return `    vec3 ${outputs[0]} = min(${base} + ${blend}, vec3(1.0));`;

          case "linearBurn":
            return `    vec3 ${outputs[0]} = max(${base} + ${blend} - vec3(1.0), vec3(0.0));`;

          case "exclusion":
            return `    vec3 ${outputs[0]} = ${base} + ${blend} - 2.0 * ${base} * ${blend};`;

          case "divide":
            return `    vec3 ${outputs[0]} = ${base} / (${blend} + 0.000001);`;

          default:
            return `    vec3 ${outputs[0]} = ${blend};`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "normal";
        const base = inputs[0];
        const blend = inputs[1];

        switch (mode) {
          case "normal":
            return `    var ${outputs[0]}: vec3<f32> = ${blend};`;

          case "multiply":
            return `    var ${outputs[0]}: vec3<f32> = ${base} * ${blend};`;

          case "screen":
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(1.0) - (vec3<f32>(1.0) - ${base}) * (vec3<f32>(1.0) - ${blend});`;

          case "overlay":
            return `    var ${outputs[0]}: vec3<f32> = mix(2.0 * ${base} * ${blend}, vec3<f32>(1.0) - 2.0 * (vec3<f32>(1.0) - ${base}) * (vec3<f32>(1.0) - ${blend}), step(0.5, ${base}));`;

          case "add":
            return `    var ${outputs[0]}: vec3<f32> = min(${base} + ${blend}, vec3<f32>(1.0));`;

          case "subtract":
            return `    var ${outputs[0]}: vec3<f32> = max(${base} - ${blend}, vec3<f32>(0.0));`;

          case "difference":
            return `    var ${outputs[0]}: vec3<f32> = abs(${base} - ${blend});`;

          case "darken":
            return `    var ${outputs[0]}: vec3<f32> = min(${base}, ${blend});`;

          case "lighten":
            return `    var ${outputs[0]}: vec3<f32> = max(${base}, ${blend});`;

          case "colorDodge":
            return `    var ${outputs[0]}: vec3<f32> = ${base} / (vec3<f32>(1.0) - ${blend} + 0.000001);`;

          case "colorBurn":
            return `    var ${outputs[0]}: vec3<f32> = vec3<f32>(1.0) - (vec3<f32>(1.0) - ${base}) / (${blend} + 0.000001);`;

          case "hardLight":
            return `    var ${outputs[0]}: vec3<f32> = mix(2.0 * ${base} * ${blend}, vec3<f32>(1.0) - 2.0 * (vec3<f32>(1.0) - ${base}) * (vec3<f32>(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "softLight":
            return `    var ${outputs[0]}: vec3<f32> = mix(2.0 * ${base} * ${blend} + ${base} * ${base} * (vec3<f32>(1.0) - 2.0 * ${blend}), sqrt(${base}) * (2.0 * ${blend} - vec3<f32>(1.0)) + 2.0 * ${base} * (vec3<f32>(1.0) - ${blend}), step(0.5, ${blend}));`;

          case "linearDodge":
            return `    var ${outputs[0]}: vec3<f32> = min(${base} + ${blend}, vec3<f32>(1.0));`;

          case "linearBurn":
            return `    var ${outputs[0]}: vec3<f32> = max(${base} + ${blend} - vec3<f32>(1.0), vec3<f32>(0.0));`;

          case "exclusion":
            return `    var ${outputs[0]}: vec3<f32> = ${base} + ${blend} - 2.0 * ${base} * ${blend};`;

          case "divide":
            return `    var ${outputs[0]}: vec3<f32> = ${base} / (${blend} + 0.000001);`;

          default:
            return `    var ${outputs[0]}: vec3<f32> = ${blend};`;
        }
      },
    },
  },
  "Color",
  [
    "blend",
    "mode",
    "composite",
    "multiply",
    "screen",
    "overlay",
    "add",
    "subtract",
    "darken",
    "lighten",
    "color",
    "colorDodge",
    "colorBurn",
    "hardLight",
    "softLight",
    "linearDodge",
    "linearBurn",
    "exclusion",
    "divide",
  ]
);

// Add operation options to the node type
BlendModeNode.hasOperation = true;
BlendModeNode.operationOptions = [
  {
    value: "normal",
    label: "Normal",
    description: "Replaces base color with blend color",
  },
  {
    value: "multiply",
    label: "Multiply",
    description: "Multiplies colors, always darkens",
  },
  {
    value: "screen",
    label: "Screen",
    description: "Inverts, multiplies, inverts again - always lightens",
  },
  {
    value: "overlay",
    label: "Overlay",
    description: "Combines Multiply and Screen based on base color",
  },
  {
    value: "add",
    label: "Add",
    description: "Adds colors together, clamped to 1.0",
  },
  {
    value: "subtract",
    label: "Subtract",
    description: "Subtracts blend from base, clamped to 0.0",
  },
  {
    value: "difference",
    label: "Difference",
    description: "Absolute difference between colors",
  },
  {
    value: "darken",
    label: "Darken",
    description: "Keeps the darker of two colors",
  },
  {
    value: "lighten",
    label: "Lighten",
    description: "Keeps the lighter of two colors",
  },
  {
    value: "colorDodge",
    label: "Color Dodge",
    description: "Brightens base by decreasing contrast",
  },
  {
    value: "colorBurn",
    label: "Color Burn",
    description: "Darkens base by increasing contrast",
  },
  {
    value: "hardLight",
    label: "Hard Light",
    description: "Combines Multiply and Screen based on blend color",
  },
  {
    value: "softLight",
    label: "Soft Light",
    description: "Softer version of Hard Light",
  },
  {
    value: "linearDodge",
    label: "Linear Dodge",
    description: "Same as Add - adds colors together",
  },
  {
    value: "linearBurn",
    label: "Linear Burn",
    description: "Adds colors then subtracts 1.0",
  },
  {
    value: "exclusion",
    label: "Exclusion",
    description: "Similar to Difference but lower contrast",
  },
  {
    value: "divide",
    label: "Divide",
    description: "Divides base by blend color",
  },
];

// Manual entry for documentation
BlendModeNode.manual = {
  description:
    "Combines two colors using various blending algorithms commonly found in image editing software like Photoshop. Each blend mode produces different visual effects based on mathematical operations between the base and blend colors.",
  html: `
    <h4>Blend Mode Categories</h4>
    <p><strong>Darkening modes:</strong> Multiply, Darken, Color Burn, Linear Burn</p>
    <p><strong>Lightening modes:</strong> Screen, Lighten, Color Dodge, Linear Dodge, Add</p>
    <p><strong>Contrast modes:</strong> Overlay, Hard Light, Soft Light</p>
    <p><strong>Comparative modes:</strong> Difference, Exclusion, Subtract, Divide</p>
    
    <h4>Common Use Cases</h4>
    <ul>
      <li><strong>Multiply:</strong> Darkening, shadows, texture overlays</li>
      <li><strong>Screen:</strong> Lightening, glow effects, light leaks</li>
      <li><strong>Overlay:</strong> Contrast enhancement, color grading</li>
      <li><strong>Add:</strong> Bright glow effects, fire, light sources</li>
      <li><strong>Difference:</strong> Psychedelic effects, edge detection</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> For alpha-aware blending, decompose the color first and handle the alpha channel separately.
    </div>
  `,
};
