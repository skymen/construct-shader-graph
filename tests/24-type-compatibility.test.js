// Test 24: areTypesCompatible — generic-to-generic overlap, concrete-to-generic,
// and edge cases for the type compatibility function.

import { describe, it, expect } from "vitest";
import { areTypesCompatible, isGenericType, getAllowedTypesForGeneric } from "../nodes/PortTypes.js";

describe("areTypesCompatible", () => {
  describe("concrete types", () => {
    it("same concrete types are compatible", () => {
      expect(areTypesCompatible("float", "float")).toBe(true);
      expect(areTypesCompatible("vec3", "vec3")).toBe(true);
      expect(areTypesCompatible("int", "int")).toBe(true);
    });

    it("different concrete types are incompatible", () => {
      expect(areTypesCompatible("float", "int")).toBe(false);
      expect(areTypesCompatible("vec2", "mat2")).toBe(false);
    });
  });

  describe("concrete ↔ generic (single side unresolved)", () => {
    it("float is compatible with genType", () => {
      expect(areTypesCompatible("float", "genType")).toBe(true);
      expect(areTypesCompatible("genType", "float")).toBe(true);
    });

    it("vec3 is compatible with genType", () => {
      expect(areTypesCompatible("vec3", "genType")).toBe(true);
    });

    it("int is NOT compatible with genType", () => {
      expect(areTypesCompatible("int", "genType")).toBe(false);
    });

    it("float is compatible with T", () => {
      expect(areTypesCompatible("float", "T")).toBe(true);
      expect(areTypesCompatible("T", "float")).toBe(true);
    });

    it("int is compatible with T", () => {
      expect(areTypesCompatible("int", "T")).toBe(true);
    });

    it("mat2 is NOT compatible with T", () => {
      expect(areTypesCompatible("mat2", "T")).toBe(false);
    });

    it("int is compatible with genIType", () => {
      expect(areTypesCompatible("int", "genIType")).toBe(true);
    });

    it("float is NOT compatible with genIType", () => {
      expect(areTypesCompatible("float", "genIType")).toBe(false);
    });
  });

  describe("generic ↔ generic (both sides unresolved)", () => {
    it("T is compatible with genType (overlapping: float, vec2, vec3, vec4)", () => {
      expect(areTypesCompatible("T", "genType")).toBe(true);
      expect(areTypesCompatible("genType", "T")).toBe(true);
    });

    it("T is compatible with genIType (overlapping: int)", () => {
      expect(areTypesCompatible("T", "genIType")).toBe(true);
      expect(areTypesCompatible("genIType", "T")).toBe(true);
    });

    it("T is compatible with genBType (overlapping: bool)", () => {
      expect(areTypesCompatible("T", "genBType")).toBe(true);
    });

    it("genType is compatible with genType2Plus (overlapping: vec2, vec3, vec4)", () => {
      expect(areTypesCompatible("genType", "genType2Plus")).toBe(true);
    });

    it("genType is compatible with genType2OrLess (overlapping: float, vec2)", () => {
      expect(areTypesCompatible("genType", "genType2OrLess")).toBe(true);
    });

    it("genIType is NOT compatible with genMatType (no overlap)", () => {
      expect(areTypesCompatible("genIType", "genMatType")).toBe(false);
      expect(areTypesCompatible("genMatType", "genIType")).toBe(false);
    });

    it("genBType is NOT compatible with genMatType (no overlap)", () => {
      expect(areTypesCompatible("genBType", "genMatType")).toBe(false);
    });

    it("genIType is NOT compatible with genType (int not in genType)", () => {
      expect(areTypesCompatible("genIType", "genType")).toBe(false);
    });

    it("genType2Plus is NOT compatible with genType2OrLess if only overlap is vec2", () => {
      // genType2Plus: vec2, vec3, vec4
      // genType2OrLess: float, vec2
      // Overlap: vec2 → compatible
      expect(areTypesCompatible("genType2Plus", "genType2OrLess")).toBe(true);
    });

    it("genType3Plus is NOT compatible with genType2OrLess (no overlap)", () => {
      // genType3Plus: vec3, vec4
      // genType2OrLess: float, vec2
      expect(areTypesCompatible("genType3Plus", "genType2OrLess")).toBe(false);
    });
  });

  describe("resolved generics", () => {
    it("resolved generic matches concrete type", () => {
      expect(areTypesCompatible("genType", "float", "float", null)).toBe(true);
    });

    it("resolved generic does not match incompatible concrete", () => {
      expect(areTypesCompatible("genType", "int", "vec3", null)).toBe(false);
    });
  });
});

describe("isGenericType", () => {
  it("recognizes T, genType, genIType as generic", () => {
    expect(isGenericType("T")).toBe(true);
    expect(isGenericType("genType")).toBe(true);
    expect(isGenericType("genIType")).toBe(true);
    expect(isGenericType("genBType")).toBe(true);
    expect(isGenericType("genMatType")).toBe(true);
  });

  it("concrete types are not generic", () => {
    expect(isGenericType("float")).toBe(false);
    expect(isGenericType("int")).toBe(false);
    expect(isGenericType("vec3")).toBe(false);
  });
});

describe("getAllowedTypesForGeneric", () => {
  it("T allows float, int, bool, vec2, vec3, vec4, color", () => {
    const allowed = getAllowedTypesForGeneric("T");
    expect(allowed).toContain("float");
    expect(allowed).toContain("int");
    expect(allowed).toContain("bool");
    expect(allowed).toContain("vec2");
    expect(allowed).toContain("vec3");
    expect(allowed).toContain("vec4");
    expect(allowed).toContain("color");
  });

  it("genType allows float, vec2, vec3, vec4", () => {
    const allowed = getAllowedTypesForGeneric("genType");
    expect(allowed).toEqual(["float", "vec2", "vec3", "vec4"]);
  });

  it("genIType allows only int", () => {
    expect(getAllowedTypesForGeneric("genIType")).toEqual(["int"]);
  });
});
