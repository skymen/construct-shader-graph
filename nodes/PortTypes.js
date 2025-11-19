// Port type definitions with colors
// Basic port types
const genType = {
  color: "#c084fc",
  name: "genType",
  editable: false,
  isGeneric: true,
  allowedTypes: ["float", "vec2", "vec3", "vec4"],
};

const genType2OrLess = {
  color: "#c084fc",
  name: "genType2OrLess",
  editable: false,
  isGeneric: true,
  allowedTypes: ["float", "vec2"],
};

const genType3OrLess = {
  color: "#c084fc",
  name: "genType3OrLess",
  editable: false,
  isGeneric: true,
  allowedTypes: ["float", "vec2", "vec3"],
};

export const PORT_TYPES = {
  // Scalar types
  float: {
    color: "#4a90e2",
    name: "Float",
    editable: true,
    defaultValue: 0.0,
    toShaderValue: (value, shaderFormat) => {
      // Floats need to have .0 if they're whole numbers
      const str = value.toString();
      return str.includes(".") ? str : str + ".0";
    },
  },
  int: {
    color: "#4a9fe2",
    name: "Int",
    editable: true,
    defaultValue: 0,
    toShaderValue: (value, shaderFormat) => {
      // Ints are the same in all shader languages
      return value.toString();
    },
  },
  bool: {
    color: "#9f4ae2",
    name: "Boolean",
    editable: true,
    defaultValue: false,
    toShaderValue: (value, shaderFormat) => {
      // Booleans are the same in all shader languages
      return value ? "true" : "false";
    },
  },

  // Vector types
  vec2: {
    color: "#e2a44a",
    name: "Vec2",
    editable: true,
    defaultValue: [0.0, 0.0],
    toShaderValue: (value, shaderFormat) => {
      const formatFloat = (v) => {
        const str = v.toString();
        return str.includes(".") ? str : str + ".0";
      };
      if (shaderFormat === "webgpu") {
        return `vec2<f32>(${formatFloat(value[0])}, ${formatFloat(value[1])})`;
      }
      // webgl1 and webgl2
      return `vec2(${formatFloat(value[0])}, ${formatFloat(value[1])})`;
    },
  },
  vec3: {
    color: "#e2844a",
    name: "Vec3",
    editable: true,
    defaultValue: [1.0, 1.0, 1.0],
    toShaderValue: (value, shaderFormat) => {
      const formatFloat = (v) => {
        const str = v.toString();
        return str.includes(".") ? str : str + ".0";
      };
      if (shaderFormat === "webgpu") {
        return `vec3<f32>(${formatFloat(value[0])}, ${formatFloat(
          value[1]
        )}, ${formatFloat(value[2])})`;
      }
      // webgl1 and webgl2
      return `vec3(${formatFloat(value[0])}, ${formatFloat(
        value[1]
      )}, ${formatFloat(value[2])})`;
    },
  },
  vec4: {
    color: "#e24a6a",
    name: "Vec4",
    editable: true,
    defaultValue: [1.0, 1.0, 1.0, 1.0],
    toShaderValue: (value, shaderFormat) => {
      const formatFloat = (v) => {
        const str = v.toString();
        return str.includes(".") ? str : str + ".0";
      };
      if (shaderFormat === "webgpu") {
        return `vec4<f32>(${formatFloat(value[0])}, ${formatFloat(
          value[1]
        )}, ${formatFloat(value[2])}, ${formatFloat(value[3])})`;
      }
      // webgl1 and webgl2
      return `vec4(${formatFloat(value[0])}, ${formatFloat(
        value[1]
      )}, ${formatFloat(value[2])}, ${formatFloat(value[3])})`;
    },
  },

  // Special types
  texture: { color: "#90e24a", name: "Texture", editable: false },

  // Composite types (for compatibility checking)
  vector: {
    color: "#e2a44a",
    name: "Vector",
    editable: false,
    isComposite: true,
    includes: ["vec2", "vec3", "vec4"],
  },
  any: {
    color: "#888888",
    name: "Any",
    editable: false,
    isComposite: true,
    includes: [
      "float",
      "int",
      "bool",
      "vec2",
      "vec3",
      "vec4",
      "texture",
      "vector",
    ],
  },

  // Generic types (templates)
  genType,
  genType2: { ...genType }, // copy for when I want 2 separately handled genTypes in a node (like mix)
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
    allowedTypes: ["bool" /* "bvec2", "bvec3", "bvec4" */],
  },
  T: {
    color: "#c084fc",
    name: "T",
    editable: false,
    isGeneric: true,
    allowedTypes: ["float", "int", "bool", "vec2", "vec3", "vec4", "color"],
  },
  genType2Plus: {
    color: "#c084fc",
    name: "Vec2+",
    editable: false,
    isGeneric: true,
    allowedTypes: ["vec2", "vec3", "vec4"],
  },
  genType3Plus: {
    color: "#c084fc",
    name: "Vec3+",
    editable: false,
    isGeneric: true,
    allowedTypes: ["vec3", "vec4"],
  },
  genType2OrLess,
  genType2OrLess2: { ...genType2OrLess },
  genType3OrLess,
  genType3OrLess2: { ...genType3OrLess },
};

// Helper function to check if a type is generic
export function isGenericType(type) {
  return PORT_TYPES[type]?.isGeneric === true;
}

// Helper function to get allowed types for a generic
export function getAllowedTypesForGeneric(genericType) {
  return PORT_TYPES[genericType]?.allowedTypes || [];
}

// Helper function to convert a value to shader format
export function toShaderValue(value, type, shaderFormat) {
  const portType = PORT_TYPES[type];
  if (portType?.toShaderValue) {
    return portType.toShaderValue(value, shaderFormat);
  }
  // Fallback: return value as string
  return value?.toString() || "0.0";
}

// Helper function to convert a type to WGSL format
export function toWGSLType(type) {
  switch (type) {
    case "float":
      return "f32";
    case "int":
      return "i32";
    case "bool":
      return "bool";
    case "vec2":
      return "vec2<f32>";
    case "vec3":
      return "vec3<f32>";
    case "vec4":
      return "vec4<f32>";
    case "mat2":
      return "mat2x2<f32>";
    case "mat3":
      return "mat3x3<f32>";
    case "mat4":
      return "mat4x4<f32>";
    default:
      // For unknown types, assume it's a vector type and add <f32>
      // This handles cases where the type might already be in a format we don't recognize
      return type.includes("<") ? type : `${type}<f32>`;
  }
}

// Helper function to check if two port types are compatible
export function areTypesCompatible(
  outputType,
  inputType,
  resolvedOutputType = null,
  resolvedInputType = null
) {
  // For custom types, we must use the resolved type
  // If custom type is provided but resolved type is null, they're incompatible
  if (outputType === "custom" && !resolvedOutputType) return false;
  if (inputType === "custom" && !resolvedInputType) return false;

  // Use resolved types if available (for generics and custom types)
  const actualOutputType = resolvedOutputType || outputType;
  const actualInputType = resolvedInputType || inputType;

  // Exact match
  if (actualOutputType === actualInputType) return true;

  // If input is generic (and not resolved), check if output is in allowed types
  if (isGenericType(inputType) && !resolvedInputType) {
    const allowedTypes = getAllowedTypesForGeneric(inputType);
    return allowedTypes.includes(actualOutputType);
  }

  // If output is generic (and not resolved), check if input is in allowed types
  if (isGenericType(outputType) && !resolvedOutputType) {
    const allowedTypes = getAllowedTypesForGeneric(outputType);
    return allowedTypes.includes(actualInputType);
  }

  // If actual types are generic (resolved from custom), check compatibility
  if (isGenericType(actualOutputType)) {
    const allowedTypes = getAllowedTypesForGeneric(actualOutputType);
    return allowedTypes.includes(actualInputType);
  }

  if (isGenericType(actualInputType)) {
    const allowedTypes = getAllowedTypesForGeneric(actualInputType);
    return allowedTypes.includes(actualOutputType);
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
