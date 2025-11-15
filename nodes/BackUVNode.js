import { NodeType } from "./NodeType.js";
import { PORT_TYPES } from "./PortTypes.js";

export const BackUVNode = new NodeType(
  "Back UV",
  [],
  [{ name: "UV", type: "vec2" }],
  PORT_TYPES.vec2.color,
  {
    webgl1: {
      dependency: `vec2 getBackUV() {
    return (destStart + (destEnd - destStart) * vTex - layoutStart) / (layoutEnd - layoutStart);
}`,
      execution: (inputs, outputs) => `    ${outputs[0]} = getBackUV();`,
    },
    webgl2: {
      dependency: `vec2 getBackUV() {
    return (destStart + (destEnd - destStart) * vTex - layoutStart) / (layoutEnd - layoutStart);
}`,
      execution: (inputs, outputs) => `    ${outputs[0]} = getBackUV();`,
    },
    webgpu: {
      dependency: ``,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec2<f32> = c3_getBackUV(input.fragPos.xy, textureBack);`,
    },
  }
);
