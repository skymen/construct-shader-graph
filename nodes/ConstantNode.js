import { NodeType } from "./NodeType.js";
import { toWGSLType, NODE_COLORS } from "./PortTypes.js";

// The value types a project constant can hold.
//
// `color` is a presentation variant of vec3 rather than a type of its own - it
// gets a colour picker in the sidebar and emits a vec3. This mirrors what
// uniforms already do, and matters because there is no `color` entry in
// PORT_TYPES; emitting one as a port type would put a bare `color` into the
// generated GLSL.
export const CONSTANT_TYPES = [
  "bool",
  "int",
  "float",
  "vec2",
  "vec3",
  "vec4",
  "color",
];

export function constantPortType(type) {
  return type === "color" ? "vec3" : type;
}

export function defaultConstantValue(type) {
  switch (type) {
    case "bool":
      return false;
    case "int":
      return 0;
    case "vec2":
      return [0, 0];
    case "vec3":
    case "color":
      return [1, 1, 1];
    case "vec4":
      return [1, 1, 1, 1];
    default:
      return 0;
  }
}

// A single node type serves every constant. The output port is declared
// `custom` and its concrete type comes from getCustomType below, which is what
// avoids one near-identical node file per supported type.
export const ConstantNode = new NodeType(
  "Constant",
  [],
  [{ name: "Value", type: "custom" }],
  NODE_COLORS.constants,
  {
    webgl1: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${
          node.constantName || "const_Unknown"
        };`,
    },
    webgl2: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    ${outputTypes[0]} ${outputs[0]} = ${
          node.constantName || "const_Unknown"
        };`,
    },
    webgpu: {
      dependency: "",
      execution: (inputs, outputs, node, inputTypes, outputTypes) =>
        `    var ${outputs[0]}: ${toWGSLType(outputTypes[0])} = ${
          node.constantName || "const_Unknown"
        };`,
    },
  },
  "Constants",
  ["constant", "const", "define", "parameter", "shared", "value"],
  { name: true, ports: false } // Name comes from the constant, not the catalogue
);

ConstantNode.getCustomType = (node) => constantPortType(node.constantType);

// Constants are known at codegen time by definition, which is what lets one
// drive an exact WebGL1 loop bound. Read through to the host record rather than
// caching the value on the node, so an edit in the sidebar takes effect without
// having to patch every live instance.
ConstantNode.foldConstant = (node, inputs, { host }) => {
  const record = host?.constants?.find((c) => c.id === node.constantId);
  return record ? record.value : null;
};
