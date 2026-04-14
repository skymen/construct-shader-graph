import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const FromLayoutPosNode = new NodeType(
  "fromLayoutPos",
  [{ name: "UV", type: "vec2" }],
  [{ name: "Value", type: "vec2" }],
  NODE_COLORS.coordConvert,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, ((${inputs[0]} - layoutStart) / (layoutEnd - layoutStart)));`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) => {
        return `    vec2 ${outputs[0]} = mix(srcOriginStart, srcOriginEnd, ((${inputs[0]} - layoutStart) / (layoutEnd - layoutStart)));`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = mix(c3Params.srcOriginStart, c3Params.srcOriginEnd, ((${inputs[0]} - c3Params.layoutStart) / (c3Params.layoutEnd - c3Params.layoutStart)));`,
    },
  },
  "Utility",
  ["layout", "position", "coordinates", "source", "origin"]
);
