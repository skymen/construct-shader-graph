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

    // Enable debug bounding boxes for debug mode
    this.bp.debugBoundingBoxes = true;

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
      this.bp.debugBoundingBoxes = false;
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
    this.bp.debugBoundingBoxes = false;
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

    // Layout each component and calculate their bounding boxes
    const componentLayouts = [];

    components.forEach((component, index) => {
      console.log(
        `Laying out component ${index + 1} with ${component.length} nodes`
      );

      // Find independent branches within this component
      const branches = this.findIndependentBranches(component, graph);
      console.log(`  Found ${branches.length} independent branch(es)`);

      let componentWidth = 0;
      let componentHeight = 0;
      const branchLayouts = [];

      if (branches.length > 1) {
        // Layout branches separately and stack them vertically
        let branchOffsetY = 0;

        branches.forEach((branch) => {
          const layout = this.layoutComponent(branch, graph);
          branchLayouts.push({ layout, offsetX: 0, offsetY: branchOffsetY });

          branchOffsetY += layout.height + this.config.branchSpacing;
          componentWidth = Math.max(componentWidth, layout.width);
        });

        componentHeight = branchOffsetY - this.config.branchSpacing;
      } else {
        // Single branch, layout normally
        const layout = this.layoutComponent(component, graph);
        branchLayouts.push({ layout, offsetX: 0, offsetY: 0 });
        componentWidth = layout.width;
        componentHeight = layout.height;
      }

      // Check if this component contains the output node
      const hasOutputNode = component.some(
        (node) => node.nodeType && node.nodeType.name === "Output"
      );

      componentLayouts.push({
        component,
        branchLayouts,
        width: componentWidth,
        height: componentHeight,
        hasOutputNode,
        x: 0,
        y: 0,
      });
    });

    // Sort components: output node's graph first, then by size (largest first)
    componentLayouts.sort((a, b) => {
      if (a.hasOutputNode && !b.hasOutputNode) return -1;
      if (!a.hasOutputNode && b.hasOutputNode) return 1;
      // Sort by area (larger first)
      return b.width * b.height - a.width * a.height;
    });

    // Pack components efficiently
    this.packComponents(componentLayouts);

    // Record debug step for final packed layout (all components together)
    if (this.debugMode && componentLayouts.length > 1) {
      const allPositions = new Map();
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      componentLayouts.forEach((compLayout) => {
        compLayout.branchLayouts.forEach((branchLayout) => {
          const offsetX = compLayout.x + branchLayout.offsetX;
          const offsetY = compLayout.y + branchLayout.offsetY;

          branchLayout.layout.positions.forEach((pos, nodeId) => {
            const finalX = pos.x + offsetX;
            const finalY = pos.y + offsetY;
            allPositions.set(nodeId, { x: finalX, y: finalY });

            minX = Math.min(minX, finalX);
            minY = Math.min(minY, finalY);
            maxX = Math.max(maxX, finalX + 200); // Approximate node width
            maxY = Math.max(maxY, finalY + 100); // Approximate node height
          });
        });
      });

      this.recordDebugStep(
        `Final: All ${componentLayouts.length} components packed together`,
        allPositions,
        {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        },
        0,
        0
      );
    }

    // Apply the final positions
    componentLayouts.forEach((compLayout) => {
      compLayout.branchLayouts.forEach((branchLayout) => {
        this.applyLayout(
          branchLayout.layout,
          compLayout.x + branchLayout.offsetX,
          compLayout.y + branchLayout.offsetY
        );
      });
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
   * Pack components efficiently using a simple bin-packing algorithm
   */
  packComponents(componentLayouts) {
    if (componentLayouts.length === 0) return;

    const spacing = this.config.subgraphSpacing;

    // First component (with output node) goes at origin
    componentLayouts[0].x = 0;
    componentLayouts[0].y = 0;

    if (componentLayouts.length === 1) return;

    // Keep track of occupied spaces
    const occupiedRects = [
      {
        x: 0,
        y: 0,
        width: componentLayouts[0].width,
        height: componentLayouts[0].height,
      },
    ];

    // Place remaining components
    for (let i = 1; i < componentLayouts.length; i++) {
      const comp = componentLayouts[i];
      const bestPos = this.findBestPosition(comp, occupiedRects, spacing);

      comp.x = bestPos.x;
      comp.y = bestPos.y;

      occupiedRects.push({
        x: comp.x,
        y: comp.y,
        width: comp.width,
        height: comp.height,
      });
    }
  }

  /**
   * Find the best position for a component by trying 4 directions from existing components
   */
  findBestPosition(component, occupiedRects, spacing) {
    const positions = [];

    // Try positions relative to each existing component
    occupiedRects.forEach((rect) => {
      // Right of this rect
      positions.push({
        x: rect.x + rect.width + spacing,
        y: rect.y,
      });

      // Below this rect
      positions.push({
        x: rect.x,
        y: rect.y + rect.height + spacing,
      });

      // Above this rect
      positions.push({
        x: rect.x,
        y: rect.y - component.height - spacing,
      });

      // Left of this rect (but not left of the first component)
      if (rect.x > 0) {
        positions.push({
          x: rect.x - component.width - spacing,
          y: rect.y,
        });
      }
    });

    // Filter out positions that would overlap with existing components
    const validPositions = positions.filter((pos) => {
      // Don't allow positions that would place component left of origin
      if (pos.x < 0) return false;

      const testRect = {
        x: pos.x,
        y: pos.y,
        width: component.width,
        height: component.height,
      };

      return !this.rectsOverlap(testRect, occupiedRects, spacing);
    });

    if (validPositions.length === 0) {
      // Fallback: place to the right of the rightmost component
      const maxX = Math.max(...occupiedRects.map((r) => r.x + r.width));
      return { x: maxX + spacing, y: 0 };
    }

    // Choose position that minimizes distance from origin (prefer compact layout)
    return validPositions.reduce((best, pos) => {
      const distBest = Math.sqrt(best.x * best.x + best.y * best.y);
      const distCurrent = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      return distCurrent < distBest ? pos : best;
    });
  }

  /**
   * Check if a rectangle overlaps with any in a list
   */
  rectsOverlap(rect, rects, spacing) {
    return rects.some((other) => {
      return !(
        rect.x + rect.width + spacing <= other.x ||
        other.x + other.width + spacing <= rect.x ||
        rect.y + rect.height + spacing <= other.y ||
        other.y + other.height + spacing <= rect.y
      );
    });
  }

  /**
   * Get all nodes in a tree up to a certain layer depth
   * Layer 0 = just the root node
   * Layer 1 = root + its immediate children
   * Layer 2 = root + children + grandchildren, etc.
   */
  getNodesUpToLayer(rootNodeId, maxDepth, layout, subgraph) {
    const result = new Set();
    const queue = [{ nodeId: rootNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();

      // Add this node to the result
      result.add(nodeId);

      // If we haven't reached max depth, add children
      if (depth < maxDepth) {
        const nodeData = subgraph.get(nodeId);
        if (nodeData && nodeData.inputs) {
          nodeData.inputs.forEach((childId) => {
            // Only add if this child is in the layout
            if (layout.positions.has(childId)) {
              queue.push({ nodeId: childId, depth: depth + 1 });
            }
          });
        }
      }
    }

    return result;
  }

  /**
   * Sort children by their port index to maintain visual order
   * This prevents unnecessary wire crossings
   */
  sortChildrenByPortIndex(parentNodeId, children, subgraph) {
    const parentData = subgraph.get(parentNodeId);
    if (!parentData || !parentData.inputConnections) return;

    // Create a map of child node ID to minimum port index
    const childPortMap = new Map();

    parentData.inputConnections.forEach((conn) => {
      if (children.includes(conn.nodeId)) {
        const currentMin = childPortMap.get(conn.nodeId);
        if (currentMin === undefined || conn.portIndex < currentMin) {
          childPortMap.set(conn.nodeId, conn.portIndex);
        }
      }
    });

    // Sort children array in place by port index (lower port index = higher up = earlier in array)
    children.sort((a, b) => {
      const portA = childPortMap.get(a) ?? Infinity;
      const portB = childPortMap.get(b) ?? Infinity;
      return portA - portB;
    });
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
        inputConnections: [], // { nodeId, portIndex } for tracking port order
        outputConnections: [], // { nodeId, portIndex } for tracking port order
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
        const endPortIndex = endNode.inputPorts.indexOf(wire.endPort);
        const startPortIndex = startNode.outputPorts.indexOf(wire.startPort);

        graph.get(endNode.id).inputs.push(startNode.id);
        graph.get(startNode.id).outputs.push(endNode.id);

        // Store port indices for ordering
        graph.get(endNode.id).inputConnections.push({
          nodeId: startNode.id,
          portIndex: endPortIndex,
        });
        graph.get(startNode.id).outputConnections.push({
          nodeId: endNode.id,
          portIndex: startPortIndex,
        });
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

        // Sort children by port index to maintain visual order and prevent wire crossings
        this.sortChildrenByPortIndex(nodeId, children, subgraph);

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

      // Sort children by port index to maintain visual order
      this.sortChildrenByPortIndex(nodeId, children, subgraph);

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

    // Vertical spacing between nodes
    const verticalSpacing = 20; // Gap between nodes for readability
    const overlapMargin = 5; // Extra margin for overlap detection to prevent tight fits

    // Removed debug logging for cleaner output

    childLayouts.forEach((child, index) => {
      const childLayout = child.layout;
      const childNode = subgraph.get(child.id)?.node;

      // Smart initial placement: try to place below previous siblings
      let proposedY = 0;

      if (index > 0) {
        // First, try to place this child just below the previous child's NODE (not full tree)
        // This allows for better packing when the previous child has a wide tree
        const prevChild = childLayouts[index - 1];
        const prevChildNode = this.bp.nodes.find((n) => n.id === prevChild.id);

        if (prevChildNode && childOffsets[index - 1]) {
          const prevChildOffset = childOffsets[index - 1];
          const prevChildPosInLayout = prevChild.layout.positions.get(
            prevChild.id
          );

          if (prevChildPosInLayout) {
            // Calculate where the previous child node actually is
            const prevChildNodeY = prevChildOffset.y + prevChildPosInLayout.y;
            const prevChildNodeHeight = prevChildNode.height || 100;

            // Place this child below the previous child's node
            proposedY =
              prevChildNodeY +
              prevChildNodeHeight +
              verticalSpacing -
              childLayout.bbox.y;
          }
        } else {
          // Fallback: use the full bounding box of the previous child
          const prevBBox = placedBBoxes[placedBBoxes.length - 1];
          if (prevBBox) {
            proposedY =
              prevBBox.y +
              prevBBox.height -
              childLayout.bbox.y +
              verticalSpacing;
          }
        }
      }

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

      // Overlap detection: Check current child's bbox against ALL nodes in placed children
      const currentChildNode = this.bp.nodes.find((n) => n.id === child.id);
      const currentChildNodeName =
        currentChildNode?.nodeType?.name || `Node ${child.id}`;

      console.log(
        `\n🔍 Positioning child ${index}: ${currentChildNodeName} (ID: ${child.id})`
      );
      console.log(`   Initial proposedY: ${proposedY.toFixed(1)}`);

      let hasOverlap = true;
      let attempts = 0;
      const maxAttempts = 100;

      // Track attempted positions to detect oscillation
      const attemptedPositions = new Map(); // position -> attempt number
      let oscillationDetected = false;

      // Calculate where this child will be placed in X
      // The child node itself should be positioned with its RIGHT edge at -(nodeWidth + horizontalSpacing)
      const childNodePos = childLayout.positions.get(child.id);
      if (!childNodePos) {
        console.error(
          `Child node ${child.id} not found in its layout! Skipping overlap detection.`
        );
        // Skip overlap detection for this child, just use the proposed position
        childOffsets.push({
          x: 0,
          y: proposedY,
          width: childLayout.bbox.width,
        });
        placedBBoxes.push({
          x: childLayout.bbox.x,
          y: proposedY + childLayout.bbox.y,
          width: childLayout.bbox.width,
          height: childLayout.bbox.height,
        });
        return; // Skip to next child
      }
      const childNodeRightEdge = -nodeWidth - horizontalSpacing;
      const childBaseX = childNodeRightEdge - childNodePos.x - nodeWidth;

      // Now calculate the actual X position of the child's bbox in the parent's coordinate system
      const actualChildBBoxX = childBaseX + childLayout.bbox.x;

      while (hasOverlap && attempts < maxAttempts && !oscillationDetected) {
        hasOverlap = false;

        // Detect oscillation: if we've tried this position before
        const positionKey = Math.round(proposedY * 10) / 10; // Round to 1 decimal
        if (attemptedPositions.has(positionKey)) {
          oscillationDetected = true;
          console.log(
            `   ⚠️ OSCILLATION DETECTED: Already tried position ${positionKey.toFixed(
              1
            )} at attempt ${attemptedPositions.get(positionKey)}`
          );
          break;
        }
        attemptedPositions.set(positionKey, attempts);

        // Calculate the current child's ENTIRE tree bounding box at this proposed position
        // Use the ACTUAL X position in the parent's coordinate system
        const currentChildBBox = {
          x: actualChildBBoxX,
          y: proposedY + childLayout.bbox.y,
          width: childLayout.bbox.width,
          height: childLayout.bbox.height,
        };

        console.log(
          `   Attempt ${attempts + 1}: Testing position y=${proposedY.toFixed(
            1
          )} (tree bbox: x:${currentChildBBox.x.toFixed(1)}-${(
            currentChildBBox.x + currentChildBBox.width
          ).toFixed(1)}, y:${currentChildBBox.y.toFixed(1)}-${(
            currentChildBBox.y + currentChildBBox.height
          ).toFixed(1)})`
        );

        // Check against previously placed children's INDIVIDUAL NODES
        let maxPushDownY = proposedY;
        let foundOverlap = false;
        const overlaps = [];

        console.log(
          `   Checking against ${placedBBoxes.length} previously placed children...`
        );

        for (let i = 0; i < placedBBoxes.length; i++) {
          const placedChildLayout = childLayouts[i].layout;
          const placedChildOffset = childOffsets[i];
          const placedChildNode = this.bp.nodes.find(
            (n) => n.id === childLayouts[i].id
          );
          const placedChildName =
            placedChildNode?.nodeType?.name || `Node ${childLayouts[i].id}`;

          console.log(
            `      Checking against placed child ${i}: ${placedChildName} at offset y=${placedChildOffset.y.toFixed(
              1
            )}`
          );

          // Calculate the actual X position of the placed child
          const placedChildNodePos = placedChildLayout.positions.get(
            childLayouts[i].id
          );
          if (!placedChildNodePos) {
            console.error(
              `Placed child node ${childLayouts[i].id} not found in its layout! Skipping this placed child.`
            );
            // Skip this placed child in overlap detection
          } else {
            const placedChildNodeRightEdge = -nodeWidth - horizontalSpacing;
            const placedChildBaseX =
              placedChildNodeRightEdge - placedChildNodePos.x - nodeWidth;

            // Get ALL nodes in the placed child's tree with ACTUAL positions
            const nodesToCheck = [];
            placedChildLayout.positions.forEach((pos, nodeId) => {
              const node = this.bp.nodes.find((n) => n.id === nodeId);
              if (node) {
                nodesToCheck.push({
                  nodeId,
                  nodeName: node.nodeType?.name || `Node ${nodeId}`,
                  x: placedChildBaseX + pos.x,
                  y: placedChildOffset.y + pos.y,
                  width: node.width || 200,
                  height: node.height || 100,
                });
              }
            });

            console.log(
              `         Found ${nodesToCheck.length} nodes in ${placedChildName}'s tree`
            );

            // Check current child's ENTIRE BBOX against each individual node in placed child
            for (const placedNode of nodesToCheck) {
              // Check for overlap in BOTH X and Y axes
              const xOverlap = !(
                currentChildBBox.x + currentChildBBox.width + overlapMargin <
                  placedNode.x ||
                placedNode.x + placedNode.width + overlapMargin <
                  currentChildBBox.x
              );

              const yOverlap = !(
                currentChildBBox.y + currentChildBBox.height + overlapMargin <
                  placedNode.y ||
                placedNode.y + placedNode.height + overlapMargin <
                  currentChildBBox.y
              );

              // Only consider it an overlap if BOTH axes overlap
              if (xOverlap && yOverlap) {
                foundOverlap = true;

                if (attempts === 0) {
                  console.log(
                    `         ❌ Current child tree bbox ` +
                      `(x:${currentChildBBox.x.toFixed(1)}-${(
                        currentChildBBox.x + currentChildBBox.width
                      ).toFixed(1)}, ` +
                      `y:${currentChildBBox.y.toFixed(1)}-${(
                        currentChildBBox.y + currentChildBBox.height
                      ).toFixed(1)}) overlaps ${placedNode.nodeName} ` +
                      `(x:${placedNode.x.toFixed(1)}-${(
                        placedNode.x + placedNode.width
                      ).toFixed(1)}, ` +
                      `y:${placedNode.y.toFixed(1)}-${(
                        placedNode.y + placedNode.height
                      ).toFixed(1)})`
                  );
                }

                // Calculate push down distance to clear this overlap
                // We need to push the ENTIRE current child bbox below this placed node
                const pushDownY =
                  placedNode.y +
                  placedNode.height -
                  currentChildBBox.y +
                  proposedY +
                  verticalSpacing;

                overlaps.push({
                  current: `Child tree`,
                  placed: `${placedNode.nodeName}`,
                  pushDown: pushDownY.toFixed(1),
                });

                maxPushDownY = Math.max(maxPushDownY, pushDownY);
              }
            }
          } // End of else block for valid placedChildNodePos
        }

        if (foundOverlap) {
          console.log(`   ❌ Found ${overlaps.length} overlap(s):`);
          overlaps.forEach((overlap, idx) => {
            console.log(
              `      ${idx + 1}. ${overlap.current} ↔️ ${
                overlap.placed
              } → push to ${overlap.pushDown}`
            );
          });

          // ALWAYS push down to avoid oscillation
          // Sequential placement should only move forward (downward)
          console.log(`   ⬇️ Pushing DOWN to ${maxPushDownY.toFixed(1)}`);
          proposedY = maxPushDownY;

          hasOverlap = true;
        } else {
          console.log(`   ✅ No overlaps found - position is good!`);
        }

        attempts++;
      }

      // Handle oscillation with fallback strategy
      if (oscillationDetected) {
        console.log(`   🔄 Applying fallback strategy for oscillation...`);

        // Strategy: Find the largest gap in the placed children and use that
        if (placedBBoxes.length > 0) {
          // Collect all Y ranges from placed children
          const yRanges = placedBBoxes
            .map((bbox) => ({
              start: bbox.y,
              end: bbox.y + bbox.height,
            }))
            .sort((a, b) => a.start - b.start);

          // Find largest gap
          let largestGap = { start: 0, size: yRanges[0].start, index: -1 };

          for (let i = 0; i < yRanges.length - 1; i++) {
            const gapStart = yRanges[i].end + verticalSpacing;
            const gapEnd = yRanges[i + 1].start - verticalSpacing;
            const gapSize = gapEnd - gapStart;

            if (
              gapSize > largestGap.size &&
              gapSize >= childLayout.bbox.height
            ) {
              largestGap = { start: gapStart, size: gapSize, index: i };
            }
          }

          // Also check gap after last child
          const lastRange = yRanges[yRanges.length - 1];
          const afterGapStart = lastRange.end + verticalSpacing;
          const afterGapSize = 10000; // Effectively infinite
          if (afterGapSize > largestGap.size) {
            largestGap = {
              start: afterGapStart,
              size: afterGapSize,
              index: yRanges.length - 1,
            };
          }

          // Place in the largest gap
          proposedY = largestGap.start - childLayout.bbox.y;
          console.log(
            `   ✅ Placed in largest gap at y=${proposedY.toFixed(
              1
            )} (gap size: ${largestGap.size.toFixed(1)})`
          );
        } else {
          // No placed children yet, just use a safe default
          proposedY = 0;
          console.log(`   ✅ Using default position y=0`);
        }
      }

      console.log(
        `   Final position: y=${proposedY.toFixed(
          1
        )} (after ${attempts} attempts)\n`
      );

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
      if (!data)
        return { nodeId, barycenter: 0, connectionCount: 0, portIndex: 0 };

      const connections =
        direction === "inputs" ? data.inputConnections : data.outputConnections;

      let sum = 0;
      let count = 0;
      let minPortIndex = Infinity;

      connections.forEach((conn) => {
        if (positions.has(conn.nodeId)) {
          // Weight the position by adding a small bias based on port index
          // This helps maintain vertical order: lower port indices should be higher up
          const positionWeight = positions.get(conn.nodeId);
          const portBias = conn.portIndex * 0.1; // Small bias to maintain port order
          sum += positionWeight + portBias;
          count++;
          minPortIndex = Math.min(minPortIndex, conn.portIndex);
        }
      });

      return {
        nodeId,
        barycenter: count > 0 ? sum / count : layer.indexOf(nodeId),
        connectionCount: count,
        portIndex: minPortIndex !== Infinity ? minPortIndex : 0,
      };
    });

    // Sort by barycenter, with special handling for single-connection nodes
    barycenters.sort((a, b) => {
      // If both have single connections to the same parent, sort by port index
      if (a.connectionCount === 1 && b.connectionCount === 1) {
        const aDiff = Math.abs(a.barycenter - b.barycenter);
        // If they're very close (likely same parent), use port index
        if (aDiff < 0.5) {
          return a.portIndex - b.portIndex;
        }
        return a.barycenter - b.barycenter;
      }
      // Otherwise sort by barycenter
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
        // Use actual node height if available, otherwise estimate
        if (node && node.height) {
          return node.height;
        }
        // Fallback: estimate based on number of ports
        const portCount = Math.max(
          node ? node.inputPorts.length : 0,
          node ? node.outputPorts.length : 0
        );
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
