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
      execution: (inputs, outputs) => `    outColor = ${inputs[0]};`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    output.color = ${inputs[0]};\n    return output;`,
    },
  },
  "Output",
  ["result", "final", "fragcolor"]
);

// Manual entry for documentation
OutputNode.manual = {
  description: "The final output node that determines the color of each pixel. Every shader graph must have exactly one Output node connected to produce visible results.",
  html: `
    <h4>Required Node</h4>
    <p>This node is <strong>required</strong> for your shader to work. Without it connected, no visual output will be produced.</p>
    
    <h4>Color Input</h4>
    <p>The Color input accepts a <code>vec4</code> (RGBA color):</p>
    <ul>
      <li><strong>R</strong> (Red): 0.0 to 1.0</li>
      <li><strong>G</strong> (Green): 0.0 to 1.0</li>
      <li><strong>B</strong> (Blue): 0.0 to 1.0</li>
      <li><strong>A</strong> (Alpha): 0.0 (transparent) to 1.0 (opaque)</li>
    </ul>
    
    <h4>Important Notes</h4>
    <ul>
      <li>Colors should typically be <strong>premultiplied</strong> - RGB values multiplied by alpha</li>
      <li>Use the <code>Premultiply</code> node if working with non-premultiplied colors</li>
      <li>Values outside 0-1 range may cause unexpected results</li>
    </ul>
    
    <div class="warning">
      <strong>Warning:</strong> Only one Output node should exist in your graph. Multiple outputs will cause errors.
    </div>
  `
};
