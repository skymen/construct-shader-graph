// graph-kinds/loop-body-kind.js
//
// Handler for 'loopBody' kind graphs.
// Implements the handler interface defined in the plan (§5.1).

import { FunctionInputNode } from "../nodes/FunctionInputNode.js";
import { FunctionOutputNode } from "../nodes/FunctionOutputNode.js";

// The Index port is always prepended to the FunctionInput outputs of a loop body.
// It is not stored in the contract; it is injected by enforceBoundaryRules.
const INDEX_PORT_DEF = { name: "Index", type: "int" };

/**
 * Loop body kind handler.
 */
export const loopBodyKindHandler = {
  kind: "loopBody",
  label: "Loop Body",
  defaultColor: "#e67e22",  // Orange tint for loop body graphs

  // ---- Contract ----

  /**
   * Validate a loop body contract.
   * @param {object} contract - { inputs: [{ id, name, type, role }], outputs: [] }
   * @returns {string[]} Array of error messages (empty if valid)
   */
  validateContract(contract) {
    // TODO: Implement in Phase 5
    return [];
  },

  /**
   * Create a default port for the contract.
   * @param {Array} existingPorts - Existing ports in the contract section
   * @returns {object} New port { id, name, type, role } (role only for inputs)
   */
  defaultPort(existingPorts) {
    // TODO: Implement in Phase 5
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
    return { id, name: "value", type: genericName, role: "acc" };
  },

  // ---- Editor / sidebar ----

  /**
   * Render the contract editor UI.
   * @param {Graph} graph - The loop body graph
   * @param {object} host - The BlueprintSystem host
   * @param {HTMLElement} container - Container element
   */
  renderContractEditor(graph, host, container) {
    // TODO: Implement in Phase 5
  },

  // ---- Boundary nodes ----

  /**
   * Add Function Input and Function Output nodes to a newly created graph.
   * Also injects the immutable Index : int output on the input boundary node.
   * @param {Graph} graph - The loop body graph
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
   * Rebuild boundary node ports from contract.
   * Always prepends the immutable Index : int output on the input node.
   * @param {Graph} graph - The loop body graph
   * @param {object} host - The BlueprintSystem host
   */
  enforceBoundaryRules(graph, host) {
    const contract = graph.data?.contract || { inputs: [], outputs: [] };
    const inputNode = graph.nodes.find((n) => n.nodeType === FunctionInputNode);
    const outputNode = graph.nodes.find((n) => n.nodeType === FunctionOutputNode);

    if (!inputNode || !outputNode) return;

    // Index is always first; then acc/arg contract inputs
    const inputOutputDefs = [
      INDEX_PORT_DEF,
      ...contract.inputs.map((p) => ({ name: p.name, type: p.type })),
    ];
    const outputInputDefs = contract.outputs.map((p) => ({ name: p.name, type: p.type }));

    host._rebuildBoundaryNodePorts(inputNode, [], inputOutputDefs);
    host._rebuildBoundaryNodePorts(outputNode, outputInputDefs, []);
  },

  // ---- Caller node-type factory ----

  /**
   * Create a ForLoop node type for calling this loop body from other graphs.
   * @param {Graph} graph - The loop body graph
   * @param {object} host - The BlueprintSystem host
   * @returns {object} Node type definition
   */
  createCallerNodeType(graph, host) {
    // TODO: Implement in Phase 5
    return null;
  },

  callerSearchPrefix: "for_loop",

  // ---- Codegen ----

  /**
   * Compute the signature for a call site.
   * @param {object} callerNode - The ForLoop node instance
   * @param {object} host - The BlueprintSystem host
   * @returns {object} { sigHash, inputTypes, outputTypes, bindings }
   */
  computeCallSiteSignature(callerNode, host) {
    // TODO: Implement in Phase 5
    return null;
  },

  /**
   * Emit the loop body function declaration for a specific signature.
   * @param {Graph} graph - The loop body graph
   * @param {object} signature - The computed signature
   * @param {string} target - 'webgl1' | 'webgl2' | 'webgpu'
   * @param {object} host - The BlueprintSystem host
   * @returns {string} Shader source for the function
   */
  emitFunctionDeclaration(graph, signature, target, host) {
    // TODO: Implement in Phase 5
    return "";
  },

  /**
   * Emit code at the call site (the for loop).
   * @param {object} callerNode - The ForLoop node instance
   * @param {object} signature - The computed signature
   * @param {object} ctx - Codegen context
   * @returns {string} Call site code with for loop
   */
  emitCallSite(callerNode, signature, ctx) {
    // TODO: Implement in Phase 5
    return "";
  },
};
