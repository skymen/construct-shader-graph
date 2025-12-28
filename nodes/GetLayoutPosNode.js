import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const GetLayoutPosNode = new NodeType(
  "getLayoutPos",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    vec2 ${outputs[0]} = mix(layoutStart, layoutEnd, ((${inputs[0]} - srcOriginStart) / (srcOriginEnd - srcOriginStart)));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    vec2 ${outputs[0]} = mix(layoutStart, layoutEnd, ((${inputs[0]} - srcOriginStart) / (srcOriginEnd - srcOriginStart)));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_getLayoutPos(${inputs[0]});`,
    },
  },
  "Utility",
  ["layout", "position", "coordinates"]
);
