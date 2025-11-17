import { NodeType } from "./NodeType.js";
import { PORT_TYPES, toWGSLType } from "./PortTypes.js";

export const GetVariableNode = new NodeType(
  "Get Variable",
  [],
  [{ name: "Value", type: "custom" }],
  "#9b59b6", // Purple color for variable nodes
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const varName = `temp_${node.selectedVariable || "variable"}`;
        const type = outputTypes[0];
        return `    ${type} ${outputs[0]} = ${varName};`;
      },
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const varName = `temp_${node.selectedVariable || "variable"}`;
        const type = outputTypes[0];
        return `    ${type} ${outputs[0]} = ${varName};`;
      },
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) => {
        const varName = `temp_${node.selectedVariable || "variable"}`;
        const type = outputTypes[0];
        // Convert type to WGSL format
        const wgslType = toWGSLType(type);
        return `    var ${outputs[0]}: ${wgslType} = ${varName};`;
      },
    },
  },
  "Variables",
  ["variable", "get", "read", "load"]
);

// Mark this node as having a variable dropdown
GetVariableNode.hasVariableDropdown = true;

// Function to determine output type based on the selected variable
GetVariableNode.getCustomType = (node, port) => {
  // Only the output port has custom type
  if (port.type !== "output") return port.portType;

  // Find the corresponding Set Variable node
  const blueprintSystem = node._blueprintSystem;
  if (!blueprintSystem) return "float"; // Fallback

  const selectedVar = node.selectedVariable;
  if (!selectedVar) return "float"; // Fallback

  // Find the Set Variable node with matching variable name
  const setVarNode = blueprintSystem.nodes.find(
    (n) => n.nodeType.name === "Set Variable" && n.customInput === selectedVar
  );

  if (!setVarNode) return "float"; // Fallback

  // Get the resolved type from the Set Variable node's input
  const inputPort = setVarNode.inputPorts[0];
  if (!inputPort) return "float"; // Fallback

  return inputPort.getResolvedType();
};
