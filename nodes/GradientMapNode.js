import { NodeType } from "./NodeType.js";
import { NODE_COLORS, toShaderValue, toWGSLType } from "./PortTypes.js";

const EPSILON = 0.0001;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function getDefaultGradientData() {
  return {
    stops: [
      { position: 0, color: [0, 0, 0, 1] },
      { position: 1, color: [1, 1, 1, 1] },
    ],
  };
}

function normalizeStops(node, outputType) {
  const sourceStops = Array.isArray(node.data?.stops) ? node.data.stops : [];

  const normalizedStops = sourceStops
    .map((stop) => {
      const color = Array.isArray(stop?.color) ? stop.color : [1, 1, 1, 1];
      const normalizedColor = [
        clamp01(Number.isFinite(color[0]) ? color[0] : 1),
        clamp01(Number.isFinite(color[1]) ? color[1] : 1),
        clamp01(Number.isFinite(color[2]) ? color[2] : 1),
        clamp01(Number.isFinite(color[3]) ? color[3] : 1),
      ];

      return {
        position: clamp01(Number.isFinite(stop?.position) ? stop.position : 0),
        color:
          outputType === "vec3"
            ? normalizedColor.slice(0, 3)
            : normalizedColor,
      };
    })
    .sort((a, b) => a.position - b.position);

  if (normalizedStops.length === 0) {
    return normalizeStops({ data: getDefaultGradientData() }, outputType);
  }

  if (normalizedStops.length === 1) {
    normalizedStops.push({
      position: 1,
      color: [...normalizedStops[0].color],
    });
  }

  return normalizedStops;
}

function buildGradientExecution(inputs, outputs, node, outputTypes, target) {
  const outputType = outputTypes[0] || node.operation || "vec4";
  const stops = normalizeStops(node, outputType);
  const progressVar = `gradient_t_${outputs[0]}`;
  const wgslType = toWGSLType(outputType);
  const declare =
    target === "webgpu"
      ? `    var ${outputs[0]}: ${wgslType};`
      : `    ${outputType} ${outputs[0]};`;
  const tempDeclare =
    target === "webgpu"
      ? `    var ${progressVar}: f32 = clamp(${inputs[0]}, 0.0, 1.0);`
      : `    float ${progressVar} = clamp(${inputs[0]}, 0.0, 1.0);`;

  const lines = [tempDeclare, declare];

  const firstColor = toShaderValue(stops[0].color, outputType, target);
  const lastColor = toShaderValue(stops[stops.length - 1].color, outputType, target);

  lines.push(`    if (${progressVar} <= ${stops[0].position.toFixed(4)}) {`);
  lines.push(`      ${outputs[0]} = ${firstColor};`);

  for (let i = 1; i < stops.length; i++) {
    const previousStop = stops[i - 1];
    const currentStop = stops[i];
    const previousColor = toShaderValue(previousStop.color, outputType, target);
    const currentColor = toShaderValue(currentStop.color, outputType, target);
    const segmentRange = Math.max(
      currentStop.position - previousStop.position,
      EPSILON
    );
    const segmentMix = `clamp((${progressVar} - ${previousStop.position.toFixed(
      4
    )}) / ${segmentRange.toFixed(4)}, 0.0, 1.0)`;

    lines.push(`    } else if (${progressVar} <= ${currentStop.position.toFixed(4)}) {`);
    lines.push(
      `      ${outputs[0]} = mix(${previousColor}, ${currentColor}, ${segmentMix});`
    );
  }

  lines.push("    } else {");
  lines.push(`      ${outputs[0]} = ${lastColor};`);
  lines.push("    }");

  return lines.join("\n");
}

export const GradientMapNode = new NodeType(
  "Gradient Map",
  [{ name: "Progress", type: "float" }],
  [{ name: "Color", type: "custom" }],
  NODE_COLORS.colorBlend,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        buildGradientExecution(inputs, outputs, node, outputTypes, "webgl1"),
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        buildGradientExecution(inputs, outputs, node, outputTypes, "webgl2"),
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        buildGradientExecution(inputs, outputs, node, outputTypes, "webgpu"),
    },
  },
  "Color",
  ["gradient", "gradient map", "color ramp", "palette", "interpolate"],
  { operations: true }
);

GradientMapNode.hasOperation = true;
GradientMapNode.operationOptions = [
  { value: "vec3", label: "Vec3" },
  { value: "vec4", label: "Vec4" },
];

GradientMapNode.hasCustomEditor = true;
GradientMapNode.customEditorConfig = {
  type: "gradient",
  label: "Gradient",
  height: 46,
};

GradientMapNode.createDefaultData = getDefaultGradientData;

GradientMapNode.getCustomType = (node, port) => {
  if (port.type !== "output") {
    return port.portType;
  }

  return node.operation || "vec4";
};

GradientMapNode.manual = {
  description:
    "Maps a float progress value across an editable list of color stops and returns either a vec3 or vec4 color.",
  html: `
    <p>Gradient Map turns a single float into a color by blending between any number of stops.</p>
    <ul>
      <li>Use <strong>Progress</strong> as the input to sample the gradient.</li>
      <li>Switch between <strong>Vec3</strong> and <strong>Vec4</strong> with the node dropdown.</li>
      <li>Click the gradient preview on the node to add, remove, and edit stops.</li>
    </ul>
  `,
};
