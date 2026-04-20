// graph-kinds/function-kind.js
//
// Handler for 'function' kind graphs.
// Implements the handler interface defined in the plan (§5.1).

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";

/**
 * Function kind handler.
 */
export const functionKindHandler = {
  kind: "function",
  label: "Function",
  defaultColor: "#4a9eff",  // Blue tint for function graphs

  // ---- Contract ----

  /**
   * Validate a function contract.
   * @param {object} contract - { inputs: [], outputs: [] }
   * @returns {string[]} Array of error messages (empty if valid)
   */
  validateContract(contract) {
    // TODO: Implement in Phase 3
    return [];
  },

  /**
   * Create a default port for the contract.
   * @param {Array} existingPorts - Existing ports in the contract section
   * @returns {object} New port { id, name, type }
   */
  defaultPort(existingPorts) {
    // TODO: Implement in Phase 3
    const id = Date.now(); // Temporary; will use proper counter
    const usedNames = new Set((existingPorts || []).map(p => p.type));
    let genericName = "T";
    const alphabet = "TUVWXYZABCDEFGHIJKLMNOPQRS";
    for (const letter of alphabet) {
      if (!usedNames.has(letter)) {
        genericName = letter;
        break;
      }
    }
    return { id, name: "value", type: genericName };
  },

  // ---- Editor / sidebar ----

  /**
   * Render the contract editor UI.
   * @param {Graph} graph - The function graph
   * @param {object} host - The BlueprintSystem host
   * @param {HTMLElement} container - Container element
   */
  renderContractEditor(graph, host, container) {
    // TODO: Implement in Phase 4
  },

  // ---- Boundary nodes ----

  /**
   * Add Function Input and Function Output nodes to a newly created graph.
   * @param {Graph} graph - The function graph
   * @param {object} host - The BlueprintSystem host
   */
  bootstrapGraph(graph, host) {
    host._withGraph(graph, () => {
      host.addNode(-150, 100, FunctionInputNode);
      host.addNode(150, 100, FunctionOutputNode);
    });
    this.enforceBoundaryRules(graph, host);
  },

  /**
   * Rebuild boundary node ports from contract, enforce rules.
   * @param {Graph} graph - The function graph
   * @param {object} host - The BlueprintSystem host
   */
  enforceBoundaryRules(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const inputNode = graph.nodes.find((n) => n.nodeType === FunctionInputNode);
    const outputNode = graph.nodes.find((n) => n.nodeType === FunctionOutputNode);

    if (!inputNode || !outputNode) return;

    // FunctionInput outputs ← contract inputs (the params enter the body as outputs)
    const inputOutputDefs = contract.inputs.map((p) => ({ name: p.name, type: p.type }));
    // FunctionOutput inputs ← contract outputs (the results leave via its inputs)
    const outputInputDefs = contract.outputs.map((p) => ({ name: p.name, type: p.type }));

    host._rebuildBoundaryNodePorts(inputNode, [], inputOutputDefs);
    host._rebuildBoundaryNodePorts(outputNode, outputInputDefs, []);
  },

  // ---- Caller node-type factory ----

  /**
   * Create a FunctionCall node type for calling this function from other graphs.
   * @param {Graph} graph - The function graph
   * @param {object} host - The BlueprintSystem host
   * @returns {object} Node type definition
   */
  createCallerNodeType(graph, host) {
    // TODO: Implement in Phase 3
    return null;
  },

  callerSearchPrefix: "function_call",

  // ---- Codegen ----

  /**
   * Compute the signature for a call site.
   * @param {object} callerNode - The FunctionCall node instance
   * @param {object} host - The BlueprintSystem host
   * @returns {object} { sigHash, inputTypes, outputTypes, bindings }
   */
  computeCallSiteSignature(callerNode, host) {
    // TODO: Implement in Phase 3
    return null;
  },

  /**
   * Emit the function declaration for a specific signature.
   * @param {Graph} graph - The function graph
   * @param {object} signature - The computed signature
   * @param {string} target - 'webgl1' | 'webgl2' | 'webgpu'
   * @param {object} host - The BlueprintSystem host
   * @returns {string} Shader source for the function
   */
  emitFunctionDeclaration(graph, signature, target, host) {
    // TODO: Implement in Phase 3
    return "";
  },

  /**
   * Emit code at the call site.
   * @param {object} callerNode - The FunctionCall node instance
   * @param {object} signature - The computed signature
   * @param {object} ctx - Codegen context
   * @returns {string} Call site code
   */
  emitCallSite(callerNode, signature, ctx) {
    // TODO: Implement in Phase 3
    return "";
  },
};
