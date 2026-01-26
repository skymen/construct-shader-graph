import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toWGSLType } from "./PortTypes.js";

export const CompositeNode = new NodeType(
  "Composite",
  [
    { name: "Source", type: "vec4" },
    { name: "Destination", type: "vec4" },
  ],
  [{ name: "Result", type: "vec4" }],
  NODE_COLORS.colorBlend,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "sourceOver";
        const src = inputs[0];
        const dst = inputs[1];

        // Porter-Duff compositing operations
        // src.rgb is assumed premultiplied, src.a is alpha
        // Formula: result = src * Fs + dst * Fd
        // Where Fs and Fd are factors based on the operation
        switch (mode) {
          case "clear":
            // Fs = 0, Fd = 0
            return `    vec4 ${outputs[0]} = vec4(0.0);`;

          case "copy":
            // Fs = 1, Fd = 0
            return `    vec4 ${outputs[0]} = ${src};`;

          case "destination":
            // Fs = 0, Fd = 1
            return `    vec4 ${outputs[0]} = ${dst};`;

          case "sourceOver":
            // Fs = 1, Fd = 1 - srcA
            return `    vec4 ${outputs[0]} = ${src} + ${dst} * (1.0 - ${src}.a);`;

          case "destinationOver":
            // Fs = 1 - dstA, Fd = 1
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst};`;

          case "sourceIn":
            // Fs = dstA, Fd = 0
            return `    vec4 ${outputs[0]} = ${src} * ${dst}.a;`;

          case "destinationIn":
            // Fs = 0, Fd = srcA
            return `    vec4 ${outputs[0]} = ${dst} * ${src}.a;`;

          case "sourceOut":
            // Fs = 1 - dstA, Fd = 0
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a);`;

          case "destinationOut":
            // Fs = 0, Fd = 1 - srcA
            return `    vec4 ${outputs[0]} = ${dst} * (1.0 - ${src}.a);`;

          case "sourceAtop":
            // Fs = dstA, Fd = 1 - srcA
            return `    vec4 ${outputs[0]} = ${src} * ${dst}.a + ${dst} * (1.0 - ${src}.a);`;

          case "destinationAtop":
            // Fs = 1 - dstA, Fd = srcA
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst} * ${src}.a;`;

          case "xor":
            // Fs = 1 - dstA, Fd = 1 - srcA
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst} * (1.0 - ${src}.a);`;

          case "lighter":
            // Fs = 1, Fd = 1 (additive)
            return `    vec4 ${outputs[0]} = min(${src} + ${dst}, vec4(1.0));`;

          default:
            return `    vec4 ${outputs[0]} = ${src} + ${dst} * (1.0 - ${src}.a);`;
        }
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "sourceOver";
        const src = inputs[0];
        const dst = inputs[1];

        switch (mode) {
          case "clear":
            return `    vec4 ${outputs[0]} = vec4(0.0);`;

          case "copy":
            return `    vec4 ${outputs[0]} = ${src};`;

          case "destination":
            return `    vec4 ${outputs[0]} = ${dst};`;

          case "sourceOver":
            return `    vec4 ${outputs[0]} = ${src} + ${dst} * (1.0 - ${src}.a);`;

          case "destinationOver":
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst};`;

          case "sourceIn":
            return `    vec4 ${outputs[0]} = ${src} * ${dst}.a;`;

          case "destinationIn":
            return `    vec4 ${outputs[0]} = ${dst} * ${src}.a;`;

          case "sourceOut":
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a);`;

          case "destinationOut":
            return `    vec4 ${outputs[0]} = ${dst} * (1.0 - ${src}.a);`;

          case "sourceAtop":
            return `    vec4 ${outputs[0]} = ${src} * ${dst}.a + ${dst} * (1.0 - ${src}.a);`;

          case "destinationAtop":
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst} * ${src}.a;`;

          case "xor":
            return `    vec4 ${outputs[0]} = ${src} * (1.0 - ${dst}.a) + ${dst} * (1.0 - ${src}.a);`;

          case "lighter":
            return `    vec4 ${outputs[0]} = min(${src} + ${dst}, vec4(1.0));`;

          default:
            return `    vec4 ${outputs[0]} = ${src} + ${dst} * (1.0 - ${src}.a);`;
        }
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node) => {
        const mode = node.operation || "sourceOver";
        const src = inputs[0];
        const dst = inputs[1];

        switch (mode) {
          case "clear":
            return `    var ${outputs[0]}: vec4<f32> = vec4<f32>(0.0);`;

          case "copy":
            return `    var ${outputs[0]}: vec4<f32> = ${src};`;

          case "destination":
            return `    var ${outputs[0]}: vec4<f32> = ${dst};`;

          case "sourceOver":
            return `    var ${outputs[0]}: vec4<f32> = ${src} + ${dst} * (1.0 - ${src}.a);`;

          case "destinationOver":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * (1.0 - ${dst}.a) + ${dst};`;

          case "sourceIn":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * ${dst}.a;`;

          case "destinationIn":
            return `    var ${outputs[0]}: vec4<f32> = ${dst} * ${src}.a;`;

          case "sourceOut":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * (1.0 - ${dst}.a);`;

          case "destinationOut":
            return `    var ${outputs[0]}: vec4<f32> = ${dst} * (1.0 - ${src}.a);`;

          case "sourceAtop":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * ${dst}.a + ${dst} * (1.0 - ${src}.a);`;

          case "destinationAtop":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * (1.0 - ${dst}.a) + ${dst} * ${src}.a;`;

          case "xor":
            return `    var ${outputs[0]}: vec4<f32> = ${src} * (1.0 - ${dst}.a) + ${dst} * (1.0 - ${src}.a);`;

          case "lighter":
            return `    var ${outputs[0]}: vec4<f32> = min(${src} + ${dst}, vec4<f32>(1.0));`;

          default:
            return `    var ${outputs[0]}: vec4<f32> = ${src} + ${dst} * (1.0 - ${src}.a);`;
        }
      },
    },
  },
  "Color",
  [
    "composite",
    "porter",
    "duff",
    "alpha",
    "blend",
    "source",
    "destination",
    "over",
    "atop",
    "in",
    "out",
    "xor",
  ]
);

// Add operation options to the node type
CompositeNode.hasOperation = true;
CompositeNode.operationOptions = [
  {
    value: "sourceOver",
    label: "Source Over",
    description: "Source over destination (normal alpha blending)",
  },
  {
    value: "destinationOver",
    label: "Destination Over",
    description: "Destination over source (source behind)",
  },
  {
    value: "sourceIn",
    label: "Source In",
    description: "Source where destination is opaque",
  },
  {
    value: "destinationIn",
    label: "Destination In",
    description: "Destination where source is opaque",
  },
  {
    value: "sourceOut",
    label: "Source Out",
    description: "Source where destination is transparent",
  },
  {
    value: "destinationOut",
    label: "Destination Out",
    description: "Destination where source is transparent",
  },
  {
    value: "sourceAtop",
    label: "Source Atop",
    description: "Source on top of destination, clipped to destination",
  },
  {
    value: "destinationAtop",
    label: "Destination Atop",
    description: "Destination on top of source, clipped to source",
  },
  {
    value: "xor",
    label: "XOR",
    description: "Non-overlapping parts of both",
  },
  {
    value: "lighter",
    label: "Lighter (Add)",
    description: "Additive blending",
  },
  {
    value: "copy",
    label: "Copy",
    description: "Source only, ignores destination",
  },
  {
    value: "destination",
    label: "Destination",
    description: "Destination only, ignores source",
  },
  {
    value: "clear",
    label: "Clear",
    description: "Transparent black",
  },
];

// Manual entry for documentation
CompositeNode.manual = {
  description:
    "Composites two colors using Porter-Duff alpha compositing operations. These operations define how source and destination pixels combine based on their alpha values.",
  html: `
    <h4>Porter-Duff Operations</h4>
    <p>These are the standard compositing operations used in graphics software and web browsers.</p>
    
    <h4>Common Operations</h4>
    <ul>
      <li><strong>Source Over:</strong> Normal alpha blending - source on top of destination</li>
      <li><strong>Source In:</strong> Mask source with destination alpha (intersection)</li>
      <li><strong>Source Out:</strong> Source where destination is transparent (cutout)</li>
      <li><strong>Source Atop:</strong> Source clipped to destination shape</li>
      <li><strong>XOR:</strong> Non-overlapping regions only</li>
    </ul>
    
    <div class="tip">
      <strong>Note:</strong> These operations assume premultiplied alpha. Use the Premultiply node if your colors are straight alpha.
    </div>
    
    <div class="tip">
      <strong>Tip:</strong> Source In is useful for masking, Source Out for cutouts, and Source Atop for painting within a shape.
    </div>
  `,
};
