import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const AppendVec3Node = new NodeType(
  "Append Vec3",
  [
    { name: "A", type: "custom" },
    { name: "B", type: "custom" },
  ],
  [{ name: "Result", type: "vec3" }],
  NODE_COLORS.vectorBuild,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]});`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]});`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = vec3<f32>(${inputs[0]}, ${inputs[1]});`,
    },
  },
  "Vector",
  ["append", "combine", "concatenate", "join", "construct", "vec3"]
);

// Function to determine custom types for inputs
AppendVec3Node.getCustomType = (node, port) => {
  const portIndex = port.index;
  if (port.type === "input") {
    // Check if this specific port is connected
    const thisPortType = node.getConnectedInputType(portIndex);

    // If this port is connected, return its actual type
    if (thisPortType !== null) {
      return thisPortType;
    }

    // This port is disconnected, check the other port
    const otherPortIndex = portIndex === 0 ? 1 : 0;
    const otherPortType = node.getConnectedInputType(otherPortIndex);

    // If both inputs are disconnected, use genType2OrLess (float or vec2)
    if (otherPortType === null) {
      return portIndex === 0 ? "genType2OrLess" : "genType2OrLess2";
    }

    // Calculate what type this disconnected input should accept based on vec3 target and other input
    const otherComponents = getComponentCount(otherPortType);
    const neededComponents = 3 - otherComponents;

    if (neededComponents <= 0) return "float";
    if (neededComponents === 1) return "float";
    if (neededComponents === 2) return "vec2";
    return "vec3";
  }

  return portIndex === 0 ? "genType2OrLess" : "genType2OrLess2";
};

// Helper function to get component count from type
function getComponentCount(type) {
  if (type === "float" || type === "int" || type === "bool") return 1;
  if (type === "vec2") return 2;
  if (type === "vec3") return 3;
  if (type === "vec4") return 4;
  return 1; // Default to 1 for unknown types
}
