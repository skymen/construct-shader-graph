// Auto Layout Engine for Shader Graph
// Implements a hierarchical graph layout algorithm (Sugiyama framework)

export class AutoLayoutEngine {
  constructor(blueprintSystem) {
    this.bp = blueprintSystem;

    // Layout configuration - absolute minimal spacing for ultra-compact layout
    this.config = {
      layerSpacing: 40, // Minimal horizontal spacing between layers
      nodeSpacing: 10, // Minimal vertical spacing between unrelated nodes
      leafNodeSpacing: 10, // Minimal vertical spacing for leaf nodes
      subgraphSpacing: 100, // Space between disconnected subgraphs
      branchSpacing: 50, // Vertical space between independent branches
      crossingReductionIterations: 8, // More iterations for better results
      animationDuration: 300, // ms for smooth transitions
    };

    // Debug mode state
    this.debugMode = false;
    this.debugSteps = [];
    this.debugCurrentStep = 0;
  }

  /**
   * Debug mode: Step-by-step auto-arrange with visualization
   * @param {boolean} selectedOnly - If true, only arrange selected nodes
   */
  debugAutoArrange(selectedOnly = false) {
    this.debugMode = true;
    this.debugSteps = [];
    this.debugCurrentStep = 0;

    // Run the layout algorithm but collect debug steps
    this.autoArrange(selectedOnly);

    // Start stepping through
    if (this.debugSteps.length > 0) {
      console.log(`DEBUG: Collected ${this.debugSteps.length} steps`);
      this.showDebugStep(0);

      // Add keyboard listener for stepping
      this.setupDebugKeyListener();
    } else {
      console.log("DEBUG: No steps collected");
      this.debugMode = false;
    }
  }

  setupDebugKeyListener() {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        this.nextDebugStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prevDebugStep();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.exitDebugMode();
        document.removeEventListener("keydown", handler);
      }
    };

    document.addEventListener("keydown", handler);
    console.log("DEBUG: Use Arrow Keys / Space to step, ESC to exit");
  }

  showDebugStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.debugSteps.length) return;

    this.debugCurrentStep = stepIndex;
    const step = this.debugSteps[stepIndex];

    console.log(
      `STEP ${stepIndex + 1}/${this.debugSteps.length}: ${step.description}`
    );

    // Apply positions for this step
    step.positions.forEach((pos, nodeId) => {
      const node = this.bp.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.x = pos.x + step.offsetX;
        node.y = pos.y + step.offsetY;
      }
    });

    // Set active nodes for opacity control
    this.bp.debugActiveNodes = new Set(step.positions.keys());

    // Show bounding box
    if (step.bbox) {
      this.bp.debugBBox = {
        x: step.bbox.x + step.offsetX,
        y: step.bbox.y + step.offsetY,
        width: step.bbox.width,
        height: step.bbox.height,
      };
      this.bp.debugBBoxLabel = step.description;
    } else {
      this.bp.debugBBox = null;
    }

    this.bp.render();
  }

  nextDebugStep() {
    if (this.debugCurrentStep < this.debugSteps.length - 1) {
      this.showDebugStep(this.debugCurrentStep + 1);
    } else {
      console.log("DEBUG: Reached end of steps");
    }
  }

  prevDebugStep() {
    if (this.debugCurrentStep > 0) {
      this.showDebugStep(this.debugCurrentStep - 1);
    }
  }

  exitDebugMode() {
    this.debugMode = false;
    this.bp.debugBBox = null;
    this.bp.debugActiveNodes = null;
    this.bp.render();
    console.log("DEBUG: Exited debug mode");
  }

  recordDebugStep(description, positions, bbox, offsetX = 0, offsetY = 0) {
    if (!this.debugMode) return;

    this.debugSteps.push({
      description,
      positions: new Map(positions),
      bbox: bbox ? { ...bbox } : null,
      offsetX,
      offsetY,
    });
  }

  /**
   * Main entry point for auto-arranging nodes
   * @param {boolean} selectedOnly - If true, only arrange selected nodes
   */
  autoArrange(selectedOnly = false) {
    // Get nodes to arrange
    const nodesToArrange =
      selectedOnly && this.bp.selectedNodes.size > 0
        ? Array.from(this.bp.selectedNodes)
        : this.bp.nodes;

    if (nodesToArrange.length === 0) {
      console.log("No nodes to arrange");
      return;
    }

    console.log(`Auto-arranging ${nodesToArrange.length} nodes...`);

    // Build dependency graph
    const graph = this.buildDependencyGraph(nodesToArrange);

    // Find connected components (subgraphs)
    const components = this.findConnectedComponents(graph);

    console.log(`Found ${components.length} connected component(s)`);

    // Layout each component separately
    let offsetX = 0;
    let maxHeight = 0;

    components.forEach((component, index) => {
      console.log(
        `Laying out component ${index + 1} with ${component.length} nodes`
      );

      // Find independent branches within this component
      const branches = this.findIndependentBranches(component, graph);
      console.log(`  Found ${branches.length} independent branch(es)`);

      if (branches.length > 1) {
        // Layout branches separately and stack them vertically
        let branchOffsetY = 0;
        let maxBranchWidth = 0;

        branches.forEach((branch, branchIndex) => {
          const layout = this.layoutComponent(branch, graph);
          this.applyLayout(layout, offsetX, branchOffsetY);

          branchOffsetY += layout.height + this.config.branchSpacing;
          maxBranchWidth = Math.max(maxBranchWidth, layout.width);
        });

        offsetX += maxBranchWidth + this.config.subgraphSpacing;
        maxHeight = Math.max(
          maxHeight,
          branchOffsetY - this.config.branchSpacing
        );
      } else {
        // Single branch, layout normally
        const layout = this.layoutComponent(component, graph);
        this.applyLayout(layout, offsetX, 0);

        offsetX += layout.width + this.config.subgraphSpacing;
        maxHeight = Math.max(maxHeight, layout.height);
      }
    });

    // Render the updated positions
    this.bp.render();

    // Center the camera view on the arranged nodes
    this.bp.centerView();

    // Record state for undo/redo with descriptive message
    this.bp.history.pushState(
      selectedOnly
        ? `Auto-arrange ${
            Array.from(this.bp.selectedNodes).length
          } selected nodes`
        : `Auto-arrange all nodes`
    );

    console.log("Auto-arrange complete");
  }

  /**
   * Build a dependency graph from nodes and their connections
   */
  buildDependencyGraph(nodes) {
    const graph = new Map();

    // Initialize graph nodes
    nodes.forEach((node) => {
      graph.set(node.id, {
        node: node,
        inputs: [], // Node IDs that feed into this one
        outputs: [], // Node IDs this feeds into
        layer: -1,
        position: 0,
      });
    });

    // Build edges from wires
    this.bp.wires.forEach((wire) => {
      const startNode = wire.startPort.node;
      const endNode = wire.endPort.node;

      // Only include connections between nodes we're arranging
      if (graph.has(startNode.id) && graph.has(endNode.id)) {
        graph.get(endNode.id).inputs.push(startNode.id);
        graph.get(startNode.id).outputs.push(endNode.id);
      }
    });

    return graph;
  }

  /**
   * Find connected components using DFS
   */
  findConnectedComponents(graph) {
    const visited = new Set();
    const components = [];

    graph.forEach((data, nodeId) => {
      if (!visited.has(nodeId)) {
        const component = [];
        this.dfsComponent(nodeId, graph, visited, component);
        components.push(component);
      }
    });

    // Sort components by size (largest first)
    components.sort((a, b) => b.length - a.length);

    return components;
  }

  /**
   * Depth-first search to find all nodes in a component
   */
  dfsComponent(nodeId, graph, visited, component) {
    visited.add(nodeId);
    component.push(nodeId);

    const data = graph.get(nodeId);
    if (!data) return;

    // Visit all connected nodes (both inputs and outputs)
    [...data.inputs, ...data.outputs].forEach((neighborId) => {
      if (graph.has(neighborId) && !visited.has(neighborId)) {
        this.dfsComponent(neighborId, graph, visited, component);
      }
    });
  }

  /**
   * Find independent branches within a connected component
   * Branches are groups of nodes that don't share any common ancestors
   */
  findIndependentBranches(nodeIds, graph) {
    // Build a map of which nodes each node can reach
    const reachabilityMap = new Map();

    nodeIds.forEach((nodeId) => {
      const reachable = new Set();
      this.findReachableNodes(nodeId, graph, reachable, nodeIds);
      reachabilityMap.set(nodeId, reachable);
    });

    // Group nodes into branches based on shared reachability
    const branches = [];
    const assigned = new Set();

    nodeIds.forEach((nodeId) => {
      if (assigned.has(nodeId)) return;

      const branch = [nodeId];
      assigned.add(nodeId);

      const reachable = reachabilityMap.get(nodeId);

      // Find all nodes that share reachability with this node
      nodeIds.forEach((otherId) => {
        if (assigned.has(otherId) || otherId === nodeId) return;

        const otherReachable = reachabilityMap.get(otherId);

        // Check if they share any reachable nodes or reach each other
        const hasOverlap =
          reachable.has(otherId) ||
          otherReachable.has(nodeId) ||
          [...reachable].some((id) => otherReachable.has(id));

        if (hasOverlap) {
          branch.push(otherId);
          assigned.add(otherId);
        }
      });

      branches.push(branch);
    });

    return branches;
  }

  /**
   * Find all nodes reachable from a given node (following outputs)
   */
  findReachableNodes(nodeId, graph, reachable, validNodes) {
    const data = graph.get(nodeId);
    if (!data) return;

    data.outputs.forEach((outputId) => {
      if (!validNodes.includes(outputId)) return;
      if (reachable.has(outputId)) return;

      reachable.add(outputId);
      this.findReachableNodes(outputId, graph, reachable, validNodes);
    });

    data.inputs.forEach((inputId) => {
      if (!validNodes.includes(inputId)) return;
      if (reachable.has(inputId)) return;

      reachable.add(inputId);
      this.findReachableNodes(inputId, graph, reachable, validNodes);
    });
  }

  /**
   * Layout a single connected component using hierarchical bottom-up approach
   */
  layoutComponent(nodeIds, graph) {
    // Create subgraph for this component
    const subgraph = new Map();
    nodeIds.forEach((id) => {
      if (graph.has(id)) {
        subgraph.set(id, graph.get(id));
      }
    });

    // Use hierarchical bottom-up layout
    return this.hierarchicalBottomUpLayout(subgraph, graph);
  }

  /**
   * Hierarchical bottom-up layout algorithm
   * Process branches breadth-first from leaves to root, treating arranged branches as atomic units
   */
  hierarchicalBottomUpLayout(subgraph, fullGraph) {
    // 1. Find the root node (output node or node with no outputs)
    const root = this.findRootNode(subgraph);

    if (!root) {
      // Fallback to traditional layout if no clear root
      return this.traditionalLayout(subgraph);
    }

    // 2. Build tree structure from root (going backwards through inputs)
    const tree = this.buildTreeFromRoot(root, subgraph);

    // 3. Process tree bottom-up (breadth-first by depth)
    const branchLayouts = new Map(); // nodeId -> { bbox, positions }
    const processedNodes = new Set();
    const nodeParents = new Map(); // Track which nodes are parents of which

    // Get nodes organized by depth (distance from root)
    const depthLevels = this.getDepthLevels(tree, root);
    const maxDepth = Math.max(...depthLevels.values());

    // Verify depth ordering: nodes should be deeper than their outputs
    this.verifyDepthOrdering(depthLevels, subgraph);

    // Process from deepest (leaves) to shallowest (root)
    for (let depth = maxDepth; depth >= 0; depth--) {
      const nodesAtDepth = [];
      depthLevels.forEach((d, nodeId) => {
        if (d === depth) nodesAtDepth.push(nodeId);
      });

      nodesAtDepth.forEach((nodeId) => {
        if (processedNodes.has(nodeId)) return;

        // Get all children (nodes that feed into this one)
        const children =
          subgraph.get(nodeId)?.inputs.filter((id) => subgraph.has(id)) || [];

        // Track parent relationships (inputs -> this node)
        children.forEach((childId) => {
          if (!nodeParents.has(childId)) {
            nodeParents.set(childId, []);
          }
          nodeParents.get(childId).push(nodeId);
        });

        // ALSO track if this node outputs to multiple parents (multi-tree node)
        const nodeData = subgraph.get(nodeId);
        if (nodeData) {
          const outputsInSubgraph = nodeData.outputs.filter((id) =>
            subgraph.has(id)
          );
          if (outputsInSubgraph.length > 1) {
            // This node outputs to multiple places - it's part of multiple trees
            if (!nodeParents.has(nodeId)) {
              nodeParents.set(nodeId, []);
            }
            // Add all output nodes as "parents" for multi-tree detection
            outputsInSubgraph.forEach((outputId) => {
              if (!nodeParents.get(nodeId).includes(outputId)) {
                nodeParents.get(nodeId).push(outputId);
              }
            });
          }
        }

        if (children.length === 0) {
          // Leaf node - create simple layout
          const layout = {
            bbox: { x: 0, y: 0, width: 200, height: 100 },
            positions: new Map([[nodeId, { x: 0, y: 0 }]]),
            nodes: [nodeId],
          };
          branchLayouts.set(nodeId, layout);

          // Record debug step
          const node = subgraph.get(nodeId)?.node;
          this.recordDebugStep(
            `Depth ${depth}: Leaf node "${node?.title || nodeId}"`,
            layout.positions,
            layout.bbox,
            0,
            0
          );
        } else {
          // Branch node - arrange children and this node
          const branchLayout = this.arrangeBranchWithChildren(
            nodeId,
            children,
            branchLayouts,
            subgraph,
            nodeParents
          );
          branchLayouts.set(nodeId, branchLayout);

          // Record debug step
          const node = subgraph.get(nodeId)?.node;
          this.recordDebugStep(
            `Depth ${depth}: Branch "${node?.title || nodeId}" with ${
              children.length
            } children`,
            branchLayout.positions,
            branchLayout.bbox,
            0,
            0
          );
        }

        processedNodes.add(nodeId);
      });
    }

    // 4. Get final layout from root
    const rootLayout = branchLayouts.get(root);

    if (!rootLayout) {
      return this.traditionalLayout(subgraph);
    }

    return {
      positions: rootLayout.positions,
      width: rootLayout.bbox.width,
      height: rootLayout.bbox.height,
    };
  }

  /**
   * Find the root node (typically the output node)
   */
  findRootNode(subgraph) {
    // Look for node with no outputs (or output node type)
    let root = null;

    subgraph.forEach((data, nodeId) => {
      const outputsInSubgraph = data.outputs.filter((id) => subgraph.has(id));
      const node = data.node;

      // Prefer actual output nodes (check by title or type name)
      if (
        node &&
        (node.title === "Output" || node.nodeType?.name === "Output")
      ) {
        root = nodeId;
        return;
      }

      // Otherwise, node with no outputs
      if (outputsInSubgraph.length === 0 && !root) {
        root = nodeId;
      }
    });

    return root;
  }

  /**
   * Build tree structure from root going backwards
   * IMPORTANT: Nodes can appear in multiple branches if they output to multiple parents
   */
  buildTreeFromRoot(root, subgraph) {
    const tree = new Map();
    const visited = new Set();

    const buildTree = (nodeId) => {
      // Don't use visited check here - nodes can be in multiple branches!
      const data = subgraph.get(nodeId);
      if (!data) return;

      const children = data.inputs.filter((id) => subgraph.has(id));

      // Only set if not already set (first parent wins for tree structure)
      if (!tree.has(nodeId)) {
        tree.set(nodeId, children);
      }

      // But still traverse children even if we've seen this node before
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          buildTree(childId);
        }
      });
    };

    buildTree(root);
    return tree;
  }

  /**
   * Get depth levels for all nodes (distance from root)
   * IMPORTANT: Nodes must be positioned AFTER their inputs (left-to-right flow)
   */
  getDepthLevels(tree, root) {
    const depths = new Map();
    depths.set(root, 0);

    const queue = [root];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      const currentDepth = depths.get(nodeId);
      const children = tree.get(nodeId) || [];

      children.forEach((childId) => {
        const existingDepth = depths.get(childId);
        const newDepth = currentDepth + 1;

        // CRITICAL: If a node already has a depth, use the MAXIMUM depth
        // This ensures nodes are positioned AFTER all their outputs (consumers)
        if (existingDepth === undefined || newDepth > existingDepth) {
          depths.set(childId, newDepth);
          queue.push(childId);
        }
      });
    }

    return depths;
  }

  /**
   * Verify that nodes are positioned after their inputs (left-to-right flow)
   */
  verifyDepthOrdering(depthLevels, subgraph) {
    let violations = 0;

    depthLevels.forEach((depth, nodeId) => {
      const data = subgraph.get(nodeId);
      if (!data) return;

      // Check all inputs (nodes that feed into this one)
      data.inputs.forEach((inputId) => {
        if (!subgraph.has(inputId)) return;

        const inputDepth = depthLevels.get(inputId);
        if (inputDepth !== undefined && inputDepth <= depth) {
          // VIOLATION: Input is at same or shallower depth than this node
          // Input should be deeper (further from root) so it's positioned to the left
          violations++;

          if (this.debugMode) {
            const node = data.node;
            const inputNode = subgraph.get(inputId)?.node;
            console.warn(
              `⚠️ Depth ordering violation: "${node?.title || nodeId}" ` +
                `(depth ${depth}) has input "${inputNode?.title || inputId}" ` +
                `at depth ${inputDepth}. Input should be deeper!`
            );
          }
        }
      });
    });

    if (violations > 0 && this.debugMode) {
      console.warn(`⚠️ Found ${violations} depth ordering violations`);
    }

    return violations === 0;
  }

  /**
   * Calculate the Y position of a specific port on a node (relative to node's top)
   * This matches the logic in Port.getPosition() in script.js
   */
  getPortYPosition(node, portIndex, isOutput) {
    if (!node) return 0;

    // SPECIAL CASE: Variable nodes have output port centered in header
    if (node.isVariable && isOutput) {
      return node.height / 2;
    }

    // Add extra offset if node has operation dropdown
    const dropdownOffset = node.nodeType?.hasOperation ? 30 : 0;

    // Add extra offset if node has custom input
    const hasLabel =
      node.nodeType?.hasCustomInput && node.nodeType?.customInputConfig?.label;
    const customInputOffset = node.nodeType?.hasCustomInput
      ? hasLabel
        ? 45
        : 30
      : 0;

    const startY = 50 + dropdownOffset + customInputOffset;

    // Calculate cumulative Y position based on actual port heights
    let y = startY;
    const ports = isOutput ? node.outputPorts : node.inputPorts;

    if (!ports) return startY;

    for (let i = 0; i < portIndex && i < ports.length; i++) {
      const port = ports[i];
      // Get the extra height needed for this port's value box
      const extraHeight = port.getExtraHeight ? port.getExtraHeight() : 0;
      y += 40 + extraHeight; // Base spacing + extra height
    }

    return y;
  }

  /**
   * Find which output port of the child connects to which input port of the parent
   * NOTE: In our tree structure, "parent" is the consumer and "child" is the provider
   * So we search child's OUTPUT ports for connections to parent's INPUT ports
   */
  findConnectedPorts(parentNode, childNode, subgraph) {
    // Find the connection between these two nodes
    let parentInputIndex = -1;
    let childOutputIndex = -1;

    if (!parentNode || !childNode) {
      return null;
    }

    // Search through CHILD's output ports (child provides data to parent)
    childNode.outputPorts?.forEach((outputPort, outIdx) => {
      outputPort.connections?.forEach((wire) => {
        // Wire has startPort and endPort
        // Since this is an output port, it's the startPort
        const connectedPort = wire.endPort;
        if (connectedPort && connectedPort.node.id === parentNode.id) {
          childOutputIndex = outIdx;
          // Find which input port on the parent
          parentNode.inputPorts?.forEach((inputPort, inIdx) => {
            if (inputPort === connectedPort) {
              parentInputIndex = inIdx;
            }
          });
        }
      });
    });

    if (childOutputIndex >= 0 && parentInputIndex >= 0) {
      return { parentInputIndex, childOutputIndex };
    }

    return null;
  }

  /**
   * Arrange a branch node with its children (which are already arranged)
   */
  arrangeBranchWithChildren(
    nodeId,
    children,
    branchLayouts,
    subgraph,
    nodeParents
  ) {
    const nodeData = subgraph.get(nodeId);
    const node = nodeData?.node;

    // Estimate node size
    const nodeWidth = 200;
    const nodeHeight = this.estimateNodeHeight(node);

    if (children.length === 0) {
      return {
        bbox: { x: 0, y: 0, width: nodeWidth, height: nodeHeight },
        positions: new Map([[nodeId, { x: 0, y: 0 }]]),
        nodes: [nodeId],
      };
    }

    // Get child branch layouts
    const childLayouts = children
      .map((childId) => ({
        id: childId,
        layout: branchLayouts.get(childId),
      }))
      .filter((c) => c.layout);

    if (childLayouts.length === 0) {
      return {
        bbox: { x: 0, y: 0, width: nodeWidth, height: nodeHeight },
        positions: new Map([[nodeId, { x: 0, y: 0 }]]),
        nodes: [nodeId],
      };
    }

    // Calculate dynamic horizontal spacing based on TOTAL nodes in children branches
    // More nodes = more horizontal space needed
    let totalNodesInChildren = 0;
    childLayouts.forEach((child) => {
      totalNodesInChildren += child.layout.nodes?.length || 1;
    });

    // Scale horizontal spacing with node count (absolute minimal padding)
    let horizontalSpacing;
    if (childLayouts.length === 1 && totalNodesInChildren === 1) {
      horizontalSpacing = 20; // Single leaf child: just enough to see the wire
    } else if (totalNodesInChildren <= 3) {
      horizontalSpacing = 30; // Few nodes: minimal spacing
    } else if (totalNodesInChildren <= 6) {
      horizontalSpacing = 40; // Several nodes: small spacing
    } else {
      horizontalSpacing = 50 + Math.min(50, (totalNodesInChildren - 6) * 10); // Many nodes: scale up slowly
    }

    // Handle nodes that are part of multiple trees
    // These nodes have either:
    // 1. Multiple inputs (multiple parents feeding into them)
    // 2. Multiple outputs (they feed into multiple branches)
    const sharedNodeAdjustments = new Map();

    childLayouts.forEach((child) => {
      const childId = child.id;
      const parents = nodeParents?.get(childId) || [];

      // Check if this node has multiple outputs (feeds multiple branches)
      const childData = subgraph.get(childId);
      const outputCount =
        childData?.outputs.filter((id) => subgraph.has(id)).length || 0;

      if (parents.length > 1 || outputCount > 1) {
        // This child is part of multiple trees
        // Record for position averaging and adjustment
        sharedNodeAdjustments.set(childId, {
          parents,
          outputCount,
          isMultiTree: true,
        });

        // Log for debugging
        if (this.debugMode) {
          const node = childData?.node;
          console.log(
            `  Multi-tree node detected: "${node?.title || childId}" ` +
              `(${parents.length} parents, ${outputCount} outputs)`
          );
        }
      }
    });

    // Position children independently - DON'T stack them sequentially!
    // Each child starts at Y=0 and only moves if there's an overlap
    // CRITICAL: Each child positions independently - no forced horizontal alignment
    // SPECIAL CASE: Single children align by port position
    const childOffsets = [];
    const placedBBoxes = []; // Track placed bounding boxes for overlap detection

    // Use absolute minimal vertical spacing for compact layout
    const verticalSpacing = 10; // Just enough to distinguish separate nodes

    // Removed debug logging for cleaner output

    childLayouts.forEach((child, index) => {
      const childLayout = child.layout;
      const childNode = subgraph.get(child.id)?.node;
      let proposedY = 0; // Start at 0, not stacking!

      // Removed verbose debug logging

      // SPECIAL CASE: If this is a single child with single connection, align by port
      if (childLayouts.length === 1 && childNode) {
        const portInfo = this.findConnectedPorts(node, childNode, subgraph);

        if (portInfo) {
          // Calculate port Y positions (relative to each node's top)
          // Parent receives data at INPUT port, child sends data from OUTPUT port
          const parentPortY = this.getPortYPosition(
            node,
            portInfo.parentInputIndex,
            false // INPUT port on parent
          );
          const childPortY = this.getPortYPosition(
            childNode,
            portInfo.childOutputIndex,
            true // OUTPUT port on child
          );

          // Get the child node's position within its own layout
          const childPosInLayout = childLayout.positions.get(child.id);

          if (childPosInLayout) {
            // The child node is at childPosInLayout.y within its layout
            // We want: parentY + parentPortY = proposedY + childPosInLayout.y + childPortY
            // Since parentY = 0: parentPortY = proposedY + childPosInLayout.y + childPortY
            // Therefore: proposedY = parentPortY - childPosInLayout.y - childPortY
            proposedY = parentPortY - childPosInLayout.y - childPortY;
          }
        }
      }

      // Check for overlaps with previously placed children
      // CRITICAL: Must check FULL BBOX including descendants, not just immediate node
      let hasOverlap = true;
      let attempts = 0;
      const maxAttempts = 20;

      while (hasOverlap && attempts < maxAttempts) {
        hasOverlap = false;

        // Create bbox for this child at the proposed position
        const proposedBBox = {
          x: childLayout.bbox.x,
          y: proposedY + childLayout.bbox.y,
          width: childLayout.bbox.width,
          height: childLayout.bbox.height,
        };

        // Check against all previously placed children's FULL BBOXES
        for (const placedBBox of placedBBoxes) {
          if (this.bboxesOverlap(proposedBBox, placedBBox)) {
            // Overlap detected - choose the direction that requires LEAST movement
            // Option 1: Push DOWN below the placed bbox
            const pushDownY =
              placedBBox.y +
              placedBBox.height -
              childLayout.bbox.y +
              verticalSpacing;

            // Option 2: Push UP above the placed bbox
            const pushUpY =
              placedBBox.y -
              childLayout.bbox.height -
              childLayout.bbox.y -
              verticalSpacing;

            // Choose the option that moves the node the least distance
            const distanceDown = Math.abs(pushDownY - proposedY);
            const distanceUp = Math.abs(pushUpY - proposedY);

            if (distanceUp < distanceDown) {
              proposedY = pushUpY;
            } else {
              proposedY = pushDownY;
            }

            hasOverlap = true;
            break;
          }
        }

        attempts++;
      }

      // Store offset with child's own width (no forced alignment)
      childOffsets.push({
        x: 0,
        y: proposedY,
        width: childLayout.bbox.width,
      });

      // Track this child's FULL BBOX for overlap detection with future children
      placedBBoxes.push({
        x: childLayout.bbox.x,
        y: proposedY + childLayout.bbox.y,
        width: childLayout.bbox.width,
        height: childLayout.bbox.height,
      });
    });

    // Calculate max width for bbox calculation
    const maxChildWidth = Math.max(
      ...childLayouts.map((c) => c.layout.bbox.width)
    );

    // CRITICAL: Position parent node anchored at TOP-RIGHT (output side)
    // The parent's RIGHT edge should be at x=0 (the anchor point)
    // This ensures children branches don't affect each other's position
    const parentY = 0; // Parent always at top

    // Parent's RIGHT edge is at x=0, so parent's LEFT edge is at -nodeWidth
    const parentX = -nodeWidth;

    // Create combined layout
    const positions = new Map();
    const allNodes = [nodeId];

    // Add parent - RIGHT edge at x=0
    positions.set(nodeId, { x: parentX, y: parentY });

    // Add all children with their offsets, positioned to the left
    // CRITICAL: Position based on where the CHILD NODE itself is, not the bbox
    // The child node's RIGHT edge should be close to the parent's LEFT edge
    childLayouts.forEach((child, index) => {
      const offset = childOffsets[index];
      const childLayout = child.layout;

      // Get the child node's position within its own layout
      const childNodePos = childLayout.positions.get(child.id);

      if (!childNodePos) {
        console.error(`Child node ${child.id} not found in its layout!`);
        return;
      }

      // The child node itself should be positioned with its RIGHT edge at -(nodeWidth + horizontalSpacing)
      // childNodePos.x is the child node's X within its layout (relative to layout origin)
      // We want: childBaseX + childNodePos.x + nodeWidth = -(nodeWidth + horizontalSpacing)
      // Therefore: childBaseX = -(nodeWidth + horizontalSpacing) - childNodePos.x - nodeWidth
      const childNodeRightEdge = -nodeWidth - horizontalSpacing;
      const childBaseX = childNodeRightEdge - childNodePos.x - nodeWidth;

      // Removed positioning debug logs

      child.layout.positions.forEach((pos, childNodeId) => {
        positions.set(childNodeId, {
          x: childBaseX + pos.x + offset.x,
          y: pos.y + offset.y,
        });
      });

      allNodes.push(...child.layout.nodes);
    });

    // Calculate bounding box
    // Account for potentially negative Y positions (port alignment)
    let minY = 0;
    let maxY = parentY + nodeHeight;

    // Calculate bbox extents
    childOffsets.forEach((offset, index) => {
      const childLayout = childLayouts[index].layout;
      const childMinY = offset.y + childLayout.bbox.y;
      const childMaxY = offset.y + childLayout.bbox.y + childLayout.bbox.height;

      minY = Math.min(minY, childMinY);
      maxY = Math.max(maxY, childMaxY);
    });

    // Adjust all positions if minY is negative
    if (minY < 0) {
      const yOffset = -minY;

      // Shift parent
      const parentPos = positions.get(nodeId);
      positions.set(nodeId, { x: parentPos.x, y: parentPos.y + yOffset });

      // Shift all children
      childLayouts.forEach((child, index) => {
        const offset = childOffsets[index];
        const childLayout = child.layout;
        const childRightEdge = -(nodeWidth + horizontalSpacing);
        const childBaseX = childRightEdge - childLayout.bbox.width;

        child.layout.positions.forEach((pos, childNodeId) => {
          const currentPos = positions.get(childNodeId);
          positions.set(childNodeId, {
            x: currentPos.x,
            y: currentPos.y + yOffset,
          });
        });
      });

      maxY += yOffset;
      minY = 0;
    }

    // Leftmost point is the widest child: -(nodeWidth + horizontalSpacing + maxChildWidth)
    const leftmostX = -(nodeWidth + horizontalSpacing + maxChildWidth);
    const bbox = {
      x: leftmostX,
      y: minY,
      width: maxChildWidth + horizontalSpacing + nodeWidth,
      height: maxY - minY,
    };

    return { bbox, positions, nodes: allNodes };
  }

  /**
   * Check if two bounding boxes overlap
   */
  bboxesOverlap(bbox1, bbox2) {
    // Absolute minimal margin - just 2px to prevent actual overlap
    const margin = 2;

    return !(
      bbox1.x + bbox1.width + margin < bbox2.x ||
      bbox2.x + bbox2.width + margin < bbox1.x ||
      bbox1.y + bbox1.height + margin < bbox2.y ||
      bbox2.y + bbox2.height + margin < bbox1.y
    );
  }

  /**
   * Estimate node height based on all components
   * Must match the actual rendering in script.js
   */
  estimateNodeHeight(node) {
    if (!node) return 100;

    // Base header height
    let height = 50;

    // Add dropdown offset if node has operation
    const dropdownOffset = node.nodeType?.hasOperation ? 30 : 0;
    height += dropdownOffset;

    // Add custom input offset if present
    const hasLabel =
      node.nodeType?.hasCustomInput && node.nodeType?.customInputConfig?.label;
    const customInputOffset = node.nodeType?.hasCustomInput
      ? hasLabel
        ? 45
        : 30
      : 0;
    height += customInputOffset;

    // Add port heights
    const portCount = Math.max(
      node.inputPorts?.length || 0,
      node.outputPorts?.length || 0
    );

    // Each port takes 40px + any extra height from the port itself
    for (let i = 0; i < portCount; i++) {
      const inputPort = node.inputPorts?.[i];
      const outputPort = node.outputPorts?.[i];
      const port = inputPort || outputPort;

      const extraHeight = port?.getExtraHeight ? port.getExtraHeight() : 0;
      height += 40 + extraHeight;
    }

    // Add bottom padding
    height += 10;

    return height;
  }

  /**
   * Traditional layout (fallback)
   */
  traditionalLayout(subgraph) {
    // 1. Assign nodes to layers (topological ordering)
    const layers = this.assignLayers(subgraph);

    // 2. Reduce crossings between layers
    this.reduceCrossings(layers, subgraph);

    // 3. Position leaf nodes close to their parents
    this.positionLeafNodes(layers, subgraph);

    // 4. Calculate final positions
    return this.calculatePositions(layers, subgraph);
  }

  /**
   * Assign nodes to layers based on their dependencies
   * Uses a modified topological sort that maximizes layer depth
   */
  assignLayers(subgraph) {
    const nodeToLayer = new Map();

    // Find root nodes (nodes with no inputs from within the subgraph)
    const roots = [];
    subgraph.forEach((data, id) => {
      const hasInputsInSubgraph = data.inputs.some((inputId) =>
        subgraph.has(inputId)
      );
      if (!hasInputsInSubgraph) {
        roots.push(id);
        nodeToLayer.set(id, 0);
      }
    });

    // If no roots found (cycle or isolated nodes), pick nodes with fewest inputs
    if (roots.length === 0) {
      let minInputs = Infinity;
      subgraph.forEach((data, id) => {
        const inputCount = data.inputs.filter((inputId) =>
          subgraph.has(inputId)
        ).length;
        if (inputCount < minInputs) {
          minInputs = inputCount;
        }
      });

      subgraph.forEach((data, id) => {
        const inputCount = data.inputs.filter((inputId) =>
          subgraph.has(inputId)
        ).length;
        if (inputCount === minInputs) {
          roots.push(id);
          nodeToLayer.set(id, 0);
        }
      });
    }

    // Multiple passes to ensure all nodes get proper layer assignments
    let changed = true;
    let iterations = 0;
    const maxIterations = subgraph.size * 2;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      subgraph.forEach((data, nodeId) => {
        // Calculate minimum layer based on inputs
        let minLayer = 0;
        let hasAssignedInputs = false;

        data.inputs.forEach((inputId) => {
          if (subgraph.has(inputId) && nodeToLayer.has(inputId)) {
            minLayer = Math.max(minLayer, nodeToLayer.get(inputId) + 1);
            hasAssignedInputs = true;
          }
        });

        // If no inputs are assigned yet and this isn't a root, skip for now
        if (!hasAssignedInputs && !roots.includes(nodeId)) {
          if (!nodeToLayer.has(nodeId)) {
            nodeToLayer.set(nodeId, 0);
            changed = true;
          }
          return;
        }

        const currentLayer = nodeToLayer.get(nodeId);
        if (currentLayer === undefined || currentLayer < minLayer) {
          nodeToLayer.set(nodeId, minLayer);
          changed = true;
        }
      });
    }

    // Organize nodes into layer arrays
    const layers = [];
    nodeToLayer.forEach((layer, nodeId) => {
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(nodeId);
    });

    // Remove empty layers and compact
    const compactLayers = layers.filter((layer) => layer && layer.length > 0);

    return compactLayers;
  }

  /**
   * Reduce edge crossings using the barycenter heuristic
   */
  reduceCrossings(layers, subgraph) {
    for (let iter = 0; iter < this.config.crossingReductionIterations; iter++) {
      // Forward pass (left to right)
      for (let i = 1; i < layers.length; i++) {
        this.sortLayerByBarycenter(
          layers[i],
          layers[i - 1],
          "inputs",
          subgraph
        );
      }

      // Backward pass (right to left)
      for (let i = layers.length - 2; i >= 0; i--) {
        this.sortLayerByBarycenter(
          layers[i],
          layers[i + 1],
          "outputs",
          subgraph
        );
      }
    }
  }

  /**
   * Sort nodes in a layer by their barycenter (average position of connected nodes)
   */
  sortLayerByBarycenter(layer, referenceLayer, direction, subgraph) {
    // Create position map for reference layer
    const positions = new Map();
    referenceLayer.forEach((nodeId, index) => {
      positions.set(nodeId, index);
    });

    // Calculate barycenter for each node in current layer
    const barycenters = layer.map((nodeId) => {
      const data = subgraph.get(nodeId);
      if (!data) return { nodeId, barycenter: 0, connectionCount: 0 };

      const connectedNodeIds =
        direction === "inputs" ? data.inputs : data.outputs;

      let sum = 0;
      let count = 0;

      connectedNodeIds.forEach((connectedId) => {
        if (positions.has(connectedId)) {
          sum += positions.get(connectedId);
          count++;
        }
      });

      return {
        nodeId,
        barycenter: count > 0 ? sum / count : layer.indexOf(nodeId),
        connectionCount: count,
      };
    });

    // Sort by barycenter, with special handling for single-connection nodes
    barycenters.sort((a, b) => {
      // If both have single connections, keep them close to their parent
      if (a.connectionCount === 1 && b.connectionCount === 1) {
        return a.barycenter - b.barycenter;
      }
      // Single-connection nodes stay near their barycenter more strictly
      return a.barycenter - b.barycenter;
    });

    // Update layer with sorted order
    layer.length = 0;
    barycenters.forEach((item) => layer.push(item.nodeId));
  }

  /**
   * Position leaf nodes (nodes with single connection) close to their parent
   */
  positionLeafNodes(layers, subgraph) {
    // Mark which nodes are leaf nodes
    const leafInfo = new Map();

    layers.forEach((layer, layerIndex) => {
      layer.forEach((nodeId) => {
        const data = subgraph.get(nodeId);
        if (!data) return;

        const inputCount = data.inputs.filter((id) => subgraph.has(id)).length;
        const outputCount = data.outputs.filter((id) =>
          subgraph.has(id)
        ).length;

        // A node is a leaf if it has exactly one connection
        if (inputCount === 1 && outputCount === 0) {
          leafInfo.set(nodeId, {
            type: "input-leaf",
            parentId: data.inputs[0],
          });
        } else if (inputCount === 0 && outputCount === 1) {
          leafInfo.set(nodeId, {
            type: "output-leaf",
            parentId: data.outputs[0],
          });
        }
      });
    });

    // Store leaf info for later use in position calculation
    this.leafInfo = leafInfo;
  }

  /**
   * Calculate final X,Y positions for all nodes
   */
  calculatePositions(layers, subgraph) {
    const positions = new Map();

    let maxWidth = 0;
    let totalHeight = 0;

    // Calculate dynamic layer spacing based on layer sizes
    const layerXPositions = [];
    let currentX = 0;

    layers.forEach((layer, layerIndex) => {
      layerXPositions.push(currentX);

      // Calculate spacing to next layer based on both layer sizes
      if (layerIndex < layers.length - 1) {
        const currentLayerSize = layer.length;
        const nextLayerSize = layers[layerIndex + 1].length;
        const avgSize = (currentLayerSize + nextLayerSize) / 2;

        // More nodes = more spacing (to reduce wire congestion)
        const sizeFactor = Math.min(2, 1 + avgSize / 10);
        const spacing = this.config.layerSpacing * sizeFactor;

        currentX += spacing;
      }
    });

    layers.forEach((layer, layerIndex) => {
      const x = layerXPositions[layerIndex];

      // Calculate actual height needed based on node sizes
      let layerHeight = 0;
      const nodeHeights = layer.map((nodeId) => {
        const node = this.bp.nodes.find((n) => n.id === nodeId);
        // Estimate node height based on number of ports
        const portCount = Math.max(
          node ? node.inputPorts.length : 0,
          node ? node.outputPorts.length : 0
        );
        // Base height + extra for each port
        const estimatedHeight = Math.max(100, 60 + portCount * 40);
        return estimatedHeight;
      });

      // Calculate spacing between nodes based on their connections and leaf status
      const nodeSpacings = layer.map((nodeId, index) => {
        if (index === layer.length - 1) return 0;

        const nextNodeId = layer[index + 1];
        const data = subgraph.get(nodeId);
        const nextData = subgraph.get(nextNodeId);

        if (!data || !nextData) return this.config.nodeSpacing;

        // Check if either node is a leaf node
        const isLeaf = this.leafInfo && this.leafInfo.has(nodeId);
        const nextIsLeaf = this.leafInfo && this.leafInfo.has(nextNodeId);

        // If both are leaf nodes with the same parent, keep them very close
        if (isLeaf && nextIsLeaf) {
          const leafData = this.leafInfo.get(nodeId);
          const nextLeafData = this.leafInfo.get(nextNodeId);
          if (leafData.parentId === nextLeafData.parentId) {
            return this.config.leafNodeSpacing;
          }
        }

        // If one is a leaf, use leaf spacing
        if (isLeaf || nextIsLeaf) {
          return this.config.leafNodeSpacing;
        }

        // If nodes share connections, keep them closer
        const sharedInputs = data.inputs.filter((id) =>
          nextData.inputs.includes(id)
        ).length;
        const sharedOutputs = data.outputs.filter((id) =>
          nextData.outputs.includes(id)
        ).length;

        if (sharedInputs > 0 || sharedOutputs > 0) {
          return this.config.nodeSpacing * 0.7; // 30% closer
        }

        // If directly connected, keep them closer
        const isConnected =
          data.outputs.includes(nextNodeId) || nextData.inputs.includes(nodeId);

        if (isConnected) {
          return this.config.nodeSpacing * 0.6;
        }

        return this.config.nodeSpacing;
      });

      // Calculate total height with variable spacing
      for (let i = 0; i < nodeHeights.length; i++) {
        layerHeight += nodeHeights[i];
        if (i < nodeHeights.length - 1) {
          layerHeight += nodeSpacings[i];
        }
      }

      totalHeight = Math.max(totalHeight, layerHeight);

      // Position nodes without vertical alignment - just stack them
      let currentY = 0;

      layer.forEach((nodeId, index) => {
        const y = currentY;

        positions.set(nodeId, { x, y });

        // Move to next node position
        currentY += nodeHeights[index] + (nodeSpacings[index] || 0);
      });

      maxWidth = x;
    });

    return {
      positions,
      width: maxWidth,
      height: totalHeight,
    };
  }

  /**
   * Apply calculated layout to actual node positions
   */
  applyLayout(layout, offsetX, offsetY) {
    layout.positions.forEach((pos, nodeId) => {
      const node = this.bp.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.x = pos.x + offsetX;
        node.y = pos.y + offsetY;
      }
    });
  }

  /**
   * Get the center position of arranged nodes (for camera centering)
   */
  getLayoutCenter(layout, offsetX, offsetY) {
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    layout.positions.forEach((pos) => {
      const x = pos.x + offsetX;
      const y = pos.y + offsetY;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
