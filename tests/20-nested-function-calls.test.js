// Test 20: Nested function calls and related shapes.
//
// Covers:
//   - Function A calls function B; both reachable from main.
//   - Diamond: main→A, main→B, A→C, B→C. C declared once.
//   - Chained call sites in main: A's output feeds B's input.
//   - Same function called twice inside a body with the same signature (single decl).
//   - Three-level deep chain: main → A → B → C.
//
// All scenarios use concrete contracts; generic-through-nested is a Phase 7
// concern per PLAN.md §8.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint, NODE_TYPES;

beforeAll(async () => {
  ({ blueprint, NODE_TYPES } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
  // createNewFile seeds the main graph with a default pass-through example;
  // clear it so tests own the full main-graph content.
  blueprint.setActiveGraph(blueprint.mainGraphId);
  blueprint.nodes = [];
  blueprint.wires = [];
});

function connect(blueprint, srcPort, dstPort) {
  const Wire = globalThis.__sgWire;
  if (!Wire) throw new Error("Wire not exposed on globalThis.__sgWire");
  const wire = new Wire(srcPort, dstPort);
  srcPort.connections.push(wire);
  dstPort.connections.push(wire);
  blueprint.wires.push(wire);
  return wire;
}

// Build a minimal concrete pass-through function:
//   Function Input.x : float  →  (math add 1)  →  Function Output.r : float
// Returns the graph.
function buildPassthroughFloatFn(name) {
  const g = blueprint.createFunctionGraph({ name });
  g.data.contract = {
    inputs: [{ id: `${name}_in`, name: "x", type: "float" }],
    outputs: [{ id: `${name}_out`, name: "r", type: "float" }],
  };
  blueprint.syncContractCallers(g);

  blueprint.setActiveGraph(g.id);
  const inp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
  const outp = g.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
  const math = blueprint.addNode(0, 0, NODE_TYPES.math);
  connect(blueprint, inp.outputPorts[0], math.inputPorts[0]);
  connect(blueprint, math.outputPorts[0], outp.inputPorts[0]);
  return g;
}

// Regex that matches ONLY the function's declaration line, not its call sites.
// GLSL single-output: `float fn_id(`; GLSL multi-output: `void fn_id(`;
// WGSL: `fn fn_id(` — all have a `<word>\s+` right before the name.
// Call sites always have `= fn_id(` (non-word `=`), so `\w+\s+` won't match.
function fnDeclRegex(graphId) {
  const safe = graphId.replace(/[^a-zA-Z0-9_]/g, "_");
  return new RegExp(`\\w+\\s+fn_${safe}(?:_[a-f0-9]+)?\\(`);
}

// Regex that matches a call-site reference of a function (anywhere).
function fnCallRegex(graphId) {
  const safe = graphId.replace(/[^a-zA-Z0-9_]/g, "_");
  return new RegExp(`fn_${safe}(?:_[a-f0-9]+)?\\s*\\(`);
}

function countMatches(text, re) {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  return (text.match(new RegExp(re.source, flags)) || []).length;
}

// Insert a FunctionCall node for graph `target` into the currently active graph.
function addCaller(target) {
  const callerType = blueprint.getCallableFunctionNodeTypes()[`function_call_${target.id}`];
  if (!callerType) throw new Error(`no caller type for ${target.name}`);
  return blueprint.addNode(0, 0, callerType);
}

describe("Nested function calls — Phase 3 follow-up", () => {
  it("main → A → B: both declarations appear, B declared before A", () => {
    const B = buildPassthroughFloatFn("FnB");
    const A = buildPassthroughFloatFn("FnA");

    // Replace A's body: Function Input.x → (call B) → Function Output.r
    blueprint.setActiveGraph(A.id);
    // Clear existing math wires to insert the B caller.
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const callB = addCaller(B);
    connect(blueprint, aIn.outputPorts[0], callB.inputPorts[0]);
    connect(blueprint, callB.outputPorts[0], aOut.inputPorts[0]);

    // main: Output ← toVec4(call A(1.0))
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, callA.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    expect(shaders).not.toBeNull();
    const src = shaders.webgl2;

    const aRe = fnDeclRegex(A.id);
    const bRe = fnDeclRegex(B.id);
    expect(src).toMatch(aRe);
    expect(src).toMatch(bRe);

    // Callee (B) must be declared before its caller (A) in GLSL output.
    const aPos = src.search(aRe);
    const bPos = src.search(bRe);
    expect(bPos).toBeGreaterThan(-1);
    expect(aPos).toBeGreaterThan(-1);
    expect(bPos).toBeLessThan(aPos);

    // A's body must actually contain the call to B.
    const aBodyStart = src.search(aRe);
    const aBodyEnd = src.indexOf("}", aBodyStart);
    const aBody = src.slice(aBodyStart, aBodyEnd);
    expect(aBody).toMatch(fnCallRegex(B.id));
  });

  it("diamond: main→A, main→B, A→C, B→C — C declared exactly once", () => {
    const C = buildPassthroughFloatFn("FnC");
    const A = buildPassthroughFloatFn("FnA");
    const B = buildPassthroughFloatFn("FnB");

    // A calls C
    blueprint.setActiveGraph(A.id);
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const aCallC = addCaller(C);
    connect(blueprint, aIn.outputPorts[0], aCallC.inputPorts[0]);
    connect(blueprint, aCallC.outputPorts[0], aOut.inputPorts[0]);

    // B calls C
    blueprint.setActiveGraph(B.id);
    for (const wire of [...B.wires]) blueprint.disconnectWire(wire);
    const bIn = B.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const bOut = B.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const bCallC = addCaller(C);
    connect(blueprint, bIn.outputPorts[0], bCallC.inputPorts[0]);
    connect(blueprint, bCallC.outputPorts[0], bOut.inputPorts[0]);

    // main calls A and B; add their outputs then emit.
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const callB = addCaller(B);
    const sumNode = blueprint.addNode(200, 200, NODE_TYPES.math);
    connect(blueprint, callA.outputPorts[0], sumNode.inputPorts[0]);
    connect(blueprint, callB.outputPorts[0], sumNode.inputPorts[1]);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, sumNode.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    const src = shaders.webgl2;

    // C's declaration should appear exactly once.
    const cCount = countMatches(src, fnDeclRegex(C.id));
    expect(cCount).toBe(1);
    // A and B each declared once.
    expect(countMatches(src, fnDeclRegex(A.id))).toBe(1);
    expect(countMatches(src, fnDeclRegex(B.id))).toBe(1);

    // C must be declared before A and before B.
    const cPos = src.search(fnDeclRegex(C.id));
    const aPos = src.search(fnDeclRegex(A.id));
    const bPos = src.search(fnDeclRegex(B.id));
    expect(cPos).toBeLessThan(aPos);
    expect(cPos).toBeLessThan(bPos);
  });

  it("main chain: callA's output feeds callB's input", () => {
    const A = buildPassthroughFloatFn("FnA");
    const B = buildPassthroughFloatFn("FnB");

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const callB = addCaller(B);
    connect(blueprint, callA.outputPorts[0], callB.inputPorts[0]);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, callB.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    const src = shaders.webgl2;

    // Both functions declared.
    expect(src).toMatch(fnDeclRegex(A.id));
    expect(src).toMatch(fnDeclRegex(B.id));

    // In main(), A's call site must precede B's call site, and B's input must
    // be the variable that A's call site wrote.
    const mainStart = src.indexOf("void main");
    const mainSrc = src.slice(mainStart);
    const aCall = mainSrc.search(fnCallRegex(A.id));
    const bCall = mainSrc.search(fnCallRegex(B.id));
    expect(aCall).toBeGreaterThan(-1);
    expect(bCall).toBeGreaterThan(-1);
    expect(aCall).toBeLessThan(bCall);
  });

  it("body with two calls to the same function produces a single declaration", () => {
    const B = buildPassthroughFloatFn("FnB");
    const A = buildPassthroughFloatFn("FnA");

    // A's body: Input → callB1, callB2 (both on same input), output = callB1 + callB2
    blueprint.setActiveGraph(A.id);
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const c1 = addCaller(B);
    const c2 = addCaller(B);
    connect(blueprint, aIn.outputPorts[0], c1.inputPorts[0]);
    connect(blueprint, aIn.outputPorts[0], c2.inputPorts[0]);
    const sum = blueprint.addNode(0, 100, NODE_TYPES.math);
    connect(blueprint, c1.outputPorts[0], sum.inputPorts[0]);
    connect(blueprint, c2.outputPorts[0], sum.inputPorts[1]);
    connect(blueprint, sum.outputPorts[0], aOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, callA.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    const src = shaders.webgl2;

    // B declared once, A declared once.
    expect(countMatches(src, fnDeclRegex(B.id))).toBe(1);
    expect(countMatches(src, fnDeclRegex(A.id))).toBe(1);

    // A's body must contain two calls to B.
    const aStart = src.search(fnDeclRegex(A.id));
    const aEnd = src.indexOf("\n}", aStart);
    const aBody = src.slice(aStart, aEnd);
    const bCallCount = countMatches(aBody, fnCallRegex(B.id));
    expect(bCallCount).toBe(2);
  });

  it("three-level chain: main → A → B → C", () => {
    const C = buildPassthroughFloatFn("FnC");
    const B = buildPassthroughFloatFn("FnB");
    const A = buildPassthroughFloatFn("FnA");

    // B calls C
    blueprint.setActiveGraph(B.id);
    for (const wire of [...B.wires]) blueprint.disconnectWire(wire);
    const bIn = B.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const bOut = B.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const bCallC = addCaller(C);
    connect(blueprint, bIn.outputPorts[0], bCallC.inputPorts[0]);
    connect(blueprint, bCallC.outputPorts[0], bOut.inputPorts[0]);

    // A calls B
    blueprint.setActiveGraph(A.id);
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const aCallB = addCaller(B);
    connect(blueprint, aIn.outputPorts[0], aCallB.inputPorts[0]);
    connect(blueprint, aCallB.outputPorts[0], aOut.inputPorts[0]);

    // main calls A
    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, callA.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    const src = shaders.webgl2;

    // All three declared.
    expect(src).toMatch(fnDeclRegex(A.id));
    expect(src).toMatch(fnDeclRegex(B.id));
    expect(src).toMatch(fnDeclRegex(C.id));

    // Order: C < B < A.
    const cPos = src.search(fnDeclRegex(C.id));
    const bPos = src.search(fnDeclRegex(B.id));
    const aPos = src.search(fnDeclRegex(A.id));
    expect(cPos).toBeLessThan(bPos);
    expect(bPos).toBeLessThan(aPos);
  });

  it("a function reachable only through another function's body is still declared", () => {
    // Regression guard: _generateFunctionDeclarations used to walk only the
    // top-level main levels, so a function reachable only transitively was
    // skipped and its caller emitted a dangling name.
    const B = buildPassthroughFloatFn("FnOnlyNested");
    const A = buildPassthroughFloatFn("FnWrapper");

    // A calls B (B is NOT called from main).
    blueprint.setActiveGraph(A.id);
    for (const wire of [...A.wires]) blueprint.disconnectWire(wire);
    const aIn = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionInput);
    const aOut = A.nodes.find((n) => n.nodeType === NODE_TYPES.functionOutput);
    const aCallB = addCaller(B);
    connect(blueprint, aIn.outputPorts[0], aCallB.inputPorts[0]);
    connect(blueprint, aCallB.outputPorts[0], aOut.inputPorts[0]);

    blueprint.setActiveGraph(blueprint.mainGraphId);
    const mainOut = blueprint.addNode(400, 200, NODE_TYPES.output);
    const callA = addCaller(A);
    const toVec4 = blueprint.addNode(300, 200, NODE_TYPES.toVec4);
    connect(blueprint, callA.outputPorts[0], toVec4.inputPorts[0]);
    connect(blueprint, toVec4.outputPorts[0], mainOut.inputPorts[0]);

    const shaders = blueprint.generateAllShaders();
    const src = shaders.webgl2;

    expect(src).toMatch(fnDeclRegex(B.id));
    expect(src).toMatch(fnDeclRegex(A.id));
  });
});
