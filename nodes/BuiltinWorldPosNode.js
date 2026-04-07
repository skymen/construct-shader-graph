import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const BuiltinWorldPosNode = new NodeType(
  "worldPos",
  [],
  [{ name: "Value", type: "vec3" }],
  NODE_COLORS.colorVec3,
  {
    webgl1: {
      dependency: "varying highp vec3 vWorldPos;",
      execution: (inputs, outputs) => `    vec3 ${outputs[0]} = vWorldPos;`,
    },
    webgl2: {
      dependency: "varying highp vec3 vWorldPos;",
      execution: (inputs, outputs) => `    vec3 ${outputs[0]} = vWorldPos;`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = input.worldPos;`,
    },
  },
  "Builtin",
  ["world", "position", "world position", "3d", "coordinates"],
);
