import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinLayerScaleNode = new NodeType(
  "layerScale",
  [],
  [{ name: "Value", type: "float" }],
  NODE_COLORS.colorFloat,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = layerScale;`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => `    float ${outputs[0]} = layerScale;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: f32 = c3Params.layerScale;`,
    },
  },
  "Builtin",
  ["layer", "scale", "size"]
);
