import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const AlphaOverNode = new NodeType(
  "Alpha Over",
  [
    { name: "Background", type: "vec4" },
    { name: "Foreground", type: "vec4" },
  ],
  [{ name: "Result", type: "vec4" }],
  PORT_TYPES.vec4.color,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const mode = node.operation || "premultiplied";
        const bg = inputs[0];
        const fg = inputs[1];

        if (mode === "premultiplied") {
          // Premultiplied alpha compositing: fg over bg
          // Result.rgb = fg.rgb + bg.rgb * (1 - fg.a)
          // Result.a = fg.a + bg.a * (1 - fg.a)
          return `    vec4 ${outputs[0]} = vec4(
        ${fg}.rgb + ${bg}.rgb * (1.0 - ${fg}.a),
        ${fg}.a + ${bg}.a * (1.0 - ${fg}.a)
    );`;
        } else {
          // Straight alpha compositing: fg over bg
          // Result.a = fg.a + bg.a * (1 - fg.a)
          // Result.rgb = (fg.rgb * fg.a + bg.rgb * bg.a * (1 - fg.a)) / Result.a
          return `    float _alphaOver_outA_${outputs[0]} = ${fg}.a + ${bg}.a * (1.0 - ${fg}.a);
    vec4 ${outputs[0]} = vec4(
        (${fg}.rgb * ${fg}.a + ${bg}.rgb * ${bg}.a * (1.0 - ${fg}.a)) / max(_alphaOver_outA_${outputs[0]}, 0.0001),
        _alphaOver_outA_${outputs[0]}
    );`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const mode = node.operation || "premultiplied";
        const bg = inputs[0];
        const fg = inputs[1];

        if (mode === "premultiplied") {
          return `    vec4 ${outputs[0]} = vec4(
        ${fg}.rgb + ${bg}.rgb * (1.0 - ${fg}.a),
        ${fg}.a + ${bg}.a * (1.0 - ${fg}.a)
    );`;
        } else {
          return `    float _alphaOver_outA_${outputs[0]} = ${fg}.a + ${bg}.a * (1.0 - ${fg}.a);
    vec4 ${outputs[0]} = vec4(
        (${fg}.rgb * ${fg}.a + ${bg}.rgb * ${bg}.a * (1.0 - ${fg}.a)) / max(_alphaOver_outA_${outputs[0]}, 0.0001),
        _alphaOver_outA_${outputs[0]}
    );`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const mode = node.operation || "premultiplied";
        const bg = inputs[0];
        const fg = inputs[1];

        if (mode === "premultiplied") {
          return `    var ${outputs[0]}: vec4f = vec4f(
        ${fg}.rgb + ${bg}.rgb * (1.0 - ${fg}.a),
        ${fg}.a + ${bg}.a * (1.0 - ${fg}.a)
    );`;
        } else {
          return `    var _alphaOver_outA_${outputs[0]}: f32 = ${fg}.a + ${bg}.a * (1.0 - ${fg}.a);
    var ${outputs[0]}: vec4f = vec4f(
        (${fg}.rgb * ${fg}.a + ${bg}.rgb * ${bg}.a * (1.0 - ${fg}.a)) / max(_alphaOver_outA_${outputs[0]}, 0.0001),
        _alphaOver_outA_${outputs[0]}
    );`;
        }
      },
    },
  },
  "Color",
  ["alpha", "composite", "layer", "over", "blend", "transparency", "merge"]
);

// Add operation options to the node type
AlphaOverNode.hasOperation = true;
AlphaOverNode.operationOptions = [
  {
    value: "premultiplied",
    label: "Premultiplied",
    description:
      "For colors where RGB is already multiplied by alpha (standard in this environment)",
  },
  {
    value: "straight",
    label: "Straight",
    description:
      "For colors where RGB is independent of alpha (non-premultiplied)",
  },
];

// Manual entry for documentation
AlphaOverNode.manual = {
  description:
    "Composites two colors by layering the Foreground over the Background using the Porter-Duff 'over' operator. The foreground's alpha determines how much it covers the background, simulating drawing one image on top of another.",
  html: `
    <h4>Alpha Modes</h4>
    <p><strong>Premultiplied:</strong> RGB values are already multiplied by alpha. This is the standard format in this shader environment and most GPU pipelines.</p>
    <p><strong>Straight:</strong> RGB values are independent of alpha (also called "unpremultiplied" or "non-associated alpha").</p>
    
    <h4>Formulas</h4>
    <p><strong>Premultiplied:</strong></p>
    <pre><code>Result.rgb = Fg.rgb + Bg.rgb × (1 - Fg.a)
Result.a = Fg.a + Bg.a × (1 - Fg.a)</code></pre>
    
    <p><strong>Straight:</strong></p>
    <pre><code>Result.a = Fg.a + Bg.a × (1 - Fg.a)
Result.rgb = (Fg.rgb × Fg.a + Bg.rgb × Bg.a × (1 - Fg.a)) / Result.a</code></pre>
    
    <h4>Behavior</h4>
    <ul>
      <li><strong>Foreground.a = 1.0:</strong> Result is entirely the foreground color</li>
      <li><strong>Foreground.a = 0.0:</strong> Result is entirely the background color</li>
      <li><strong>Foreground.a = 0.5:</strong> Colors are blended based on both alphas</li>
    </ul>
    
    <h4>Common Use Cases</h4>
    <ul>
      <li>Layering semi-transparent textures</li>
      <li>Compositing UI elements over backgrounds</li>
      <li>Building up complex visuals from multiple layers</li>
      <li>Simulating how paint or graphics are drawn sequentially</li>
    </ul>
    
    <div class="tip">
      <strong>Tip:</strong> Use Premultiplied mode (default) when working with texture samples in this environment. Use Straight mode only if you've explicitly unpremultiplied your colors.
    </div>
  `,
};
