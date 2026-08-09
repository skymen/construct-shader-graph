// constant-fold.js
//
// Answers one question: "is the value arriving at this input port knowable at
// codegen time, and if so, what is it?"
//
// This exists because of GLSL ES 1.00 Appendix A, which restricts a `for` loop
// index to being compared against a *constant expression*. That is a grammar
// rule, not an optimisation - `for (int i = 0; i < var_17; i++)` is rejected at
// parse time even when the driver can prove var_17 never changes. So folding has
// to happen here, while we are still emitting text, or not at all.
//
// Scope is deliberately narrow. This is NOT a general optimiser and it does not
// rewrite variable naming: `Int Input(42)` still emits its `int var_7 = 42;`
// temporary for ordinary consumers. Folding is consulted only where the target
// language demands a constant expression. Anywhere else, the shader compiler
// already folds better than we would, and rewriting the whole pipeline to do it
// twice would churn every golden file for no gain.
//
// A node opts in by setting `foldConstant` on its NodeType, following the same
// "flag on the instance" convention as hasOperation / getCustomType /
// createDefaultData:
//
//   MyNode.foldConstant = (node, inputs, ctx) => <raw JS value> | null;
//
// `inputs` is an array of { value, type }, one per input port, already folded -
// the hook is never called unless every input folded. Returning null (or
// undefined, or a non-finite number) means "not constant", and that propagates
// all the way out.

import { toShaderValue, isGenericType } from "./nodes/PortTypes.js";

// Guards against a pathological chain. The editor prevents cycles
// (tests/13-cycle-prevention), so this is a backstop, not the real defence.
const MAX_FOLD_DEPTH = 64;

// Walks back from an input port through foldable nodes.
// Returns { value, type } or null the moment it hits anything unknown.
export function resolveConstantExpression(port, host, depth = 0) {
  if (!port || depth > MAX_FOLD_DEPTH) return null;

  // Nothing wired in: the port's own inline value is the constant, if it has one.
  if (!port.connections || port.connections.length === 0) {
    if (port.isEditable && port.value !== undefined) {
      return { value: port.value, type: port.getResolvedType() };
    }
    return null;
  }

  const sourcePort = port.connections[0]?.startPort;
  const node = sourcePort?.node;
  if (!node) return null;

  const fold = node.nodeType?.foldConstant;
  if (typeof fold !== "function") return null;

  // Every input has to fold, or the node does not.
  const inputs = [];
  for (const inputPort of node.inputPorts) {
    const folded = resolveConstantExpression(inputPort, host, depth + 1);
    if (!folded) return null;
    inputs.push(folded);
  }

  // Port.getResolvedType() falls back to the generic's own name when a generic
  // never got bound, so `genType` can arrive here as if it were a type. The
  // operands are concrete regardless, so infer from them - otherwise an
  // unresolved generic anywhere in the chain would block folding for everything
  // downstream of it too.
  const declaredType = sourcePort.getResolvedType();
  const outputType = isGenericType(declaredType)
    ? (inferScalarResultType(inputs) ?? declaredType)
    : declaredType;

  let value;
  try {
    value = fold(node, inputs, { host, outputType, outputPort: sourcePort });
  } catch {
    // A hook that throws is treated as "not constant" rather than taking the
    // whole codegen pass down with it.
    return null;
  }

  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;

  return { value, type: outputType };
}

// Convenience for the constant-expression positions that need a loop count:
// resolves and coerces to a non-negative integer, or null.
//
// Negative folds to 0 rather than null. A negative count is a zero-iteration
// loop in every target, and saying so explicitly beats the old behaviour, where
// a literal -5 failed the "is it constant" regex and produced a 64-iteration
// loop whose break happened to fire immediately.
export function resolveConstantCount(port, host) {
  const folded = resolveConstantExpression(port, host);
  if (!folded) return null;

  const n = Number(folded.value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

// Formats a folded value for a target. Thin wrapper over toShaderValue so
// callers do not need to import both.
export function formatConstant(value, type, target) {
  return toShaderValue(value, type, target);
}

// --- helpers for foldConstant hooks -----------------------------------------

// True for the scalar types the arithmetic hooks handle. Vectors and matrices
// are deliberately excluded: component-wise folding with GLSL's mixed
// scalar/vector operand rules is a lot of surface area for no current caller,
// and returning null just means the shader compiler folds it instead.
export function isFoldableScalar(type) {
  return type === "float" || type === "int" || type === "bool";
}

// The scalar type an arithmetic result takes, given its folded operands.
//
// Needed because a node's output port can still be carrying an unresolved
// generic (`genType`) at codegen time - Port.getResolvedType() falls back to the
// generic's own name rather than a concrete type. The operands are concrete
// either way, so infer from them instead of declining to fold.
//
// GLSL has no implicit int/float promotion, so a mixed pair is not a well-formed
// expression to begin with; return null rather than guessing which way it goes.
export function inferScalarResultType(inputs) {
  if (!inputs.length) return null;
  if (inputs.every((i) => i.type === "int")) return "int";
  if (inputs.every((i) => i.type === "float")) return "float";
  return null;
}

// Parses a customInput string into a number, or null.
export function parseNumericInput(raw, fallback) {
  const text = String(raw ?? fallback ?? "").trim();
  if (text.length === 0) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
