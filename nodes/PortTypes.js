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
      "texture",
      "vector",
    ],
  },

  // Generic types (templates)
  genType: {
    color: "#c084fc",
    name: "genType",
    editable: false,
    isGeneric: true,
    allowedTypes: ["float", "vec2", "vec3", "vec4"],
  },
  // genDType: {
  //   color: "#c084fc",
  //   name: "genDType",
  //   editable: false,
  //   isGeneric: true,
  //   allowedTypes: ["double", "dvec2", "dvec3", "dvec4"],
  // },
  genIType: {
    color: "#c084fc",
    name: "genIType",
    editable: false,
    isGeneric: true,
    allowedTypes: ["int" /* "ivec2", "ivec3", "ivec4" */],
  },
  // genUType: {
  //   color: "#c084fc",
  //   name: "genUType",
  //   editable: false,
  //   isGeneric: true,
  //   allowedTypes: ["uint", "uvec2", "uvec3", "uvec4"],
  // },
  genBType: {
    color: "#c084fc",
    name: "genBType",
    editable: false,
    isGeneric: true,
    allowedTypes: ["boolean" /* "bvec2", "bvec3", "bvec4" */],
  },
  T: {
    color: "#c084fc",
    name: "T",
    editable: false,
    isGeneric: true,
    allowedTypes: ["float", "int", "boolean", "vec2", "vec3", "vec4", "color"],
  },
};

// Helper function to check if a type is generic
export function isGenericType(type) {
  return PORT_TYPES[type]?.isGeneric === true;
}

// Helper function to get allowed types for a generic
export function getAllowedTypesForGeneric(genericType) {
  return PORT_TYPES[genericType]?.allowedTypes || [];
}

// Helper function to check if two port types are compatible
export function areTypesCompatible(
  outputType,
  inputType,
  resolvedOutputType = null,
  resolvedInputType = null
) {
  // Use resolved types if available (for generics)
  const actualOutputType = resolvedOutputType || outputType;
  const actualInputType = resolvedInputType || inputType;

  // Exact match
  if (actualOutputType === actualInputType) return true;

  // If input is generic, check if output is in allowed types
  if (isGenericType(inputType) && !resolvedInputType) {
    const allowedTypes = getAllowedTypesForGeneric(inputType);
    return allowedTypes.includes(actualOutputType);
  }

  // If output is generic, check if input is in allowed types
  if (isGenericType(outputType) && !resolvedOutputType) {
    const allowedTypes = getAllowedTypesForGeneric(outputType);
    return allowedTypes.includes(actualInputType);
  }

  // Check if input type is a composite that includes the output type
  const inputTypeDef = PORT_TYPES[actualInputType];
  if (
    inputTypeDef?.isComposite &&
    inputTypeDef.includes.includes(actualOutputType)
  ) {
    return true;
  }

  // Check if output type is a composite that includes the input type
  const outputTypeDef = PORT_TYPES[actualOutputType];
  if (
    outputTypeDef?.isComposite &&
    outputTypeDef.includes.includes(actualInputType)
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
