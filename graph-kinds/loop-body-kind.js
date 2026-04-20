// graph-kinds/loop-body-kind.js
//
// Handler for 'loopBody' kind graphs.
// Implements the handler interface defined in the plan (§5.1).

/**
 * Loop body kind handler.
 * Full implementation comes in Phase 5; this is a minimal stub for Phase 1.
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
   * Also injects the Index : int input.
   * @param {Graph} graph - The loop body graph
   * @param {object} host - The BlueprintSystem host
   */
  bootstrapGraph(graph, host) {
    // TODO: Implement in Phase 5
  },

  /**
   * Rebuild boundary node ports from contract, enforce rules.
   * Re-injects Index for loopBody, prevents deletion of boundary nodes.
   * @param {Graph} graph - The loop body graph
   * @param {object} host - The BlueprintSystem host
   */
  enforceBoundaryRules(graph, host) {
    // TODO: Implement in Phase 5
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
