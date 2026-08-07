// graph-kinds/contract.js
//
// The vocabulary shared by every subgraph contract: the port types on offer,
// what counts as generic, and identifier hygiene for emitted code.
//
// This is a leaf module — it imports no handler, so handlers can import it
// without a cycle. It exists because function-kind and loop-body-kind each grew
// their own copy of this and then drifted: the loop-body copy decided
// "generic" meant "one character long", which made `genType` register as a
// CONCRETE type and get emitted verbatim as a GLSL type name.

import {
  PORT_TYPES,
  isGenericType,
  GENERIC_LETTERS,
} from "../nodes/PortTypes.js";

export const CONCRETE_TYPE_OPTIONS = [
  { value: "float", label: "Float" },
  { value: "int", label: "Int" },
  { value: "bool", label: "Bool" },
  { value: "vec2", label: "Vec2" },
  { value: "vec3", label: "Vec3" },
  { value: "vec4", label: "Vec4" },
  { value: "mat2", label: "Mat2" },
  { value: "mat3", label: "Mat3" },
  { value: "mat4", label: "Mat4" },
];

// Named slots first (T, U, ... — pick one per independent type variable), then
// the constrained families.
export const GENERIC_TYPE_OPTIONS = [
  ...GENERIC_LETTERS.map((letter) => ({ value: letter, label: letter })),
  { value: "genType", label: "genType" },
  { value: "genType2OrLess", label: "genType2OrLess" },
  { value: "genType3OrLess", label: "genType3OrLess" },
  { value: "genType2Plus", label: "genType2Plus" },
  { value: "genType3Plus", label: "genType3Plus" },
  { value: "genIType", label: "genIType" },
  { value: "genBType", label: "genBType" },
  { value: "genMatType", label: "genMatType" },
];

export function isConcreteType(type) {
  return typeof type === "string" && !isGenericType(type);
}

// Is this a type the app actually knows? A contract port carrying anything else
// would be emitted straight into the shader as a type name, so both handlers
// reject it rather than generating something that cannot compile.
export function isKnownType(type) {
  return typeof type === "string" && !!PORT_TYPES[type];
}

// Stable 6-char hex hash of a string.
export function shortHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).slice(0, 6).padStart(6, "0");
}

// Convert a string to a valid GLSL/WGSL identifier.
export function sanitizeId(str) {
  return String(str)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([^a-zA-Z_])/, "_$1");
}

// A fresh contract-port id. Ids are opaque and only ever compared for equality.
export function newPortId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// The first type option not already used in `existingPorts`, so adding several
// ports in a row gives you distinct generics rather than N copies of T.
export function pickFreeGenericType(existingPorts) {
  const used = new Set((existingPorts || []).map((p) => p.type));
  for (const opt of GENERIC_TYPE_OPTIONS) {
    if (!used.has(opt.value)) return opt.value;
  }
  return "T";
}
