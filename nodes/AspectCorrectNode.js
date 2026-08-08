import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// Turns a size into the scale vector that makes normalised coordinates square.
//
// Normalised coordinates run 0..1 on both axes whatever the real shape is, so a
// circle drawn there comes out as an ellipse and a rotation comes out as a
// shear. Multiplying by this vector puts both axes on the same footing; divide
// by it again to get back. The largest component is always 1, so the corrected
// coordinates stay in 0..1 and never lose precision under lowp.
export const AspectCorrectNode = new NodeType(
  "Aspect Correct",
  [{ name: "Size", type: "vec2", defaultValue: [1, 1] }],
  [{ name: "Aspect", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    highmedp vec2 ${outputs[0]} = abs(${inputs[0]}) / max(max(abs(${inputs[0]}.x), abs(${inputs[0]}.y)), 0.00001);`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    highmedp vec2 ${outputs[0]} = abs(${inputs[0]}) / max(max(abs(${inputs[0]}.x), abs(${inputs[0]}.y)), 0.00001);`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = abs(${inputs[0]}) / max(max(abs(${inputs[0]}.x), abs(${inputs[0]}.y)), 0.00001);`,
    },
  },
  "Utility",
  ["aspect", "ratio", "square", "correct", "normalize", "uv", "shape"]
);

AspectCorrectNode.manual = {
  description:
    "Turns any size into the scale vector that makes normalised coordinates square. Multiply coordinates by it to correct them, divide to undo. The larger component is always exactly 1.",
  html: `
    <h4>Formula</h4>
    <pre><code>Aspect = abs(Size) / max(abs(Size.x), abs(Size.y))</code></pre>

    <h4>The problem it solves</h4>
    <p>
      Normalised coordinates run 0..1 on both axes no matter the real shape. On a 200&times;100
      frame that means one horizontal unit covers twice the distance of one vertical unit — so a
      circle drawn there comes out an ellipse, and a rotation comes out a shear.
    </p>

    <h4>The round trip</h4>
    <pre><code>corrected = uv * Aspect       // work in square space
result    = corrected / Aspect  // back to UV space</code></pre>
    <p>
      Anything measuring distance or angle belongs between those two lines: circles, rotations,
      radial gradients, SDF shapes.
    </p>

    <h4>Why normalise by the larger component</h4>
    <p>
      Dividing by the max rather than by one fixed axis keeps both components in 0..1, so
      corrected coordinates never grow past the range they started in. The conventional
      <code>vec2(w/h, 1.0)</code> blows up on wide frames and loses precision under
      <code>lowp</code>.
    </p>

    <h4>What to feed it</h4>
    <ul>
      <li><code>srcOriginSizePx</code> — the current frame, the usual choice</li>
      <li><code>destSize</code> — the on-screen destination rect</li>
      <li><code>layoutSize</code> — for layout-space effects</li>
    </ul>

    <div class="tip">
      <code>Rotate Around Point</code> takes this directly on its <code>Aspect</code> input, so
      you rarely need to do the multiply and divide by hand for rotations.
    </div>
  `,
};
