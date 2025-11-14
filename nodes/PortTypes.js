// Port type definitions with colors
// Basic port types
export const PORT_TYPES = {
  // Scalar types
  float: { color: "#4a90e2", name: "Float", editable: true, defaultValue: 0.0 },
  int: { color: "#4a9fe2", name: "Int", editable: true, defaultValue: 0 },
  boolean: {
    color: "#9f4ae2",
    name: "Boolean",
    editable: true,
    defaultValue: false,
  },

  // Vector types
  vec2: { color: "#e2a44a", name: "Vec2", editable: false },
  vec3: { color: "#e2844a", name: "Vec3", editable: false },
  vec4: { color: "#e24a6a", name: "Vec4", editable: false },

  // Special types
  color: { color: "#e24a90", name: "Color", editable: false }, // This is vec3
  texture: { color: "#90e24a", name: "Texture", editable: false },

  // Composite types (for compatibility checking)
  vector: {
    color: "#e2a44a",
    name: "Vector",
    editable: false,
    isComposite: true,
    includes: ["vec2", "vec3", "vec4", "color"], // color is vec3
  },
  any: {
    color: "#888888",
    name: "Any",
    editable: false,
    isComposite: true,
    includes: [
      "float",
      "int",
      "boolean",
      "vec2",
      "vec3",
      "vec4",
      "color",
      "texture",
      "vector",
    ],
  },
};

// Helper function to check if two port types are compatible
export function areTypesCompatible(outputType, inputType) {
  // Exact match
  if (outputType === inputType) return true;

  // Check if input type is a composite that includes the output type
  const inputTypeDef = PORT_TYPES[inputType];
  if (inputTypeDef?.isComposite && inputTypeDef.includes.includes(outputType)) {
    return true;
  }

  // Check if output type is a composite that includes the input type
  const outputTypeDef = PORT_TYPES[outputType];
  if (
    outputTypeDef?.isComposite &&
    outputTypeDef.includes.includes(inputType)
  ) {
    return true;
  }

  // Check if both are composites with overlapping types
  if (inputTypeDef?.isComposite && outputTypeDef?.isComposite) {
    return inputTypeDef.includes.some((type) =>
      outputTypeDef.includes.includes(type)
    );
  }

  return false;
}
