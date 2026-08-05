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
