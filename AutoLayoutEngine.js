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
      childrenGapBase: 15, // Base vertical gap between children
      childrenGapPerLevel: 15, // Additional gap per level of depth in child's subtree
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
  autoArrange(
    selectedOnly = false,
    { recordHistory = true, fitComments = true } = {},
  ) {
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

    this.beginLayoutSession();

    // Record what each comment encloses before anything moves, so the boxes can
    // be put back around the same nodes afterwards. Capturing here rather than
    // just before applyLayout is equivalent - nothing between here and the apply
    // loop touches node.x/.y - and it keeps both halves inside one _withGraph
    // scope, which autoArrangeAllGraphs relies on.
    const commentSnapshot = fitComments
      ? this.bp.captureCommentMembership()
      : null;

    // Build dependency graph
    const graph = this.buildDependencyGraph(nodesToArrange);

    // Stand each comment in for the section it encloses, so the packer places
    // that section as one block and the box comes out tight. Skipped for a
    // selection arrange, where a partly-selected comment would contract a partial
    // set of its members.
    if (commentSnapshot && !selectedOnly) {
      this.contractComments(graph, commentSnapshot);
    }

    // Find connected components (subgraphs)
    const components = this.findConnectedComponents(graph);

    console.log(`Found ${components.length} connected component(s)`);

    // Layout each component and calculate their bounding boxes
    const componentLayouts = [];
    // Sinks with no context of their own, parked beside their provider once the
    // rest of the graph has landed. See the satellite rule below.
    const satellites = [];

    components.forEach((component, index) => {
      console.log(
        `Laying out component ${index + 1} with ${component.length} nodes`
      );

      // Find independent branches within this component
      const allBranches = this.findIndependentBranches(component, graph);

      // A secondary branch that is a single node with inputs elsewhere in the
      // component has no context of its own - in practice a Set Variable pill
      // whose whole chain belongs to another sink. Stacking it below the primary
      // block would leave it a screen away from the node it reads. Park it beside
      // that node once everything else is placed instead.
      const branches = [];
      allBranches.forEach((branch, branchIndex) => {
        const isSatellite =
          branchIndex > 0 &&
          branch.length === 1 &&
          (graph.get(branch[0])?.inputs || []).some((id) => graph.has(id));
        if (isSatellite) {
          const node = this.bp.nodes.find((n) => n.id === branch[0]);
          if (node) {
            satellites.push(node);
            return;
          }
        }
        branches.push(branch);
      });

      if (branches.length === 0) return;

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
        const layout = this.layoutComponent(branches[0], graph);
        branchLayouts.push({ layout, offsetX: 0, offsetY: 0 });
        componentWidth = layout.width;
        componentHeight = layout.height;
      }

      // Anchor for selection arranges: the first branch's root, i.e. the primary
      // sink. Taking findRootNode over the whole component could hand back a
      // secondary sink, and packComponentsPreservingRoots would then move the
      // entire tree to hold that one pill still.
      const primaryBranch = new Map();
      branches[0].forEach((nodeId) => {
        if (graph.has(nodeId)) primaryBranch.set(nodeId, graph.get(nodeId));
      });
      const rootNodeId = this.findRootNode(primaryBranch);
      const rootNode = rootNodeId
        ? this.bp.nodes.find((n) => n.id === rootNodeId)
        : null;

      componentLayouts.push({
        component,
        branchLayouts,
        width: componentWidth,
        height: componentHeight,
        rootNode, // Store root node reference
        x: 0,
        y: 0,
      });
    });

    // Largest first, so the biggest block anchors the packing.
    componentLayouts.sort((a, b) => b.width * b.height - a.width * a.height);

    // Pack components efficiently
    // If selectedOnly, preserve root node positions
    if (selectedOnly) {
      this.packComponentsPreservingRoots(componentLayouts);
    } else {
      this.packComponents(componentLayouts);
    }

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

    // Park the satellites now that every other node has its final position, and
    // against every live node rather than just their own component, so they
    // cannot land on anything. Ordered by this.bp.nodes for determinism.
    if (satellites.length > 0) {
      const parkOrder = this.bp.nodes.filter((n) => satellites.includes(n));
      const obstacles = this.bp.nodes.filter((n) => !satellites.includes(n));
      for (const node of parkOrder) {
        this.bp.parkNodeBesideItsSource(node, obstacles);
        obstacles.push(node);
      }
    }

    // Put the comment boxes back around their nodes. Before render() so the first
    // paint is right, and before centerView() so anything the separation pass
    // displaced is inside the framed bounds. Separation is skipped for a
    // selection arrange: packComponentsPreservingRoots anchors on the root node's
    // live position, so a displaced root would make the group walk further across
    // the canvas on every subsequent arrange.
    if (commentSnapshot) {
      this.bp.refitCommentsToMembership(commentSnapshot, {
        separate: !selectedOnly,
      });
    }

    // Render the updated positions
    this.bp.render();

    // Center the camera view on the arranged nodes (only when arranging all nodes)
    if (!selectedOnly) {
      this.bp.centerView();
    }

    // Record state for undo/redo with descriptive message. Callers that
    // arrange as part of a larger edit (importGraphIR, the fan-out rewrites,
    // deleteDanglingNodes) pass recordHistory: false and push their own single
    // entry instead of leaving two behind. The comment refit above is part of
    // whichever entry that is - do not give it one of its own.
    if (recordHistory) {
      this.bp.history.pushState(
        selectedOnly
          ? `Auto-arrange ${
              Array.from(this.bp.selectedNodes).length
            } selected nodes`
          : `Auto-arrange all nodes`
      );
    }

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
   * Pack components while preserving root node positions (for selected nodes only)
   * Root nodes stay at their current positions unless they would overlap
   */
  packComponentsPreservingRoots(componentLayouts) {
    if (componentLayouts.length === 0) return;

    const spacing = this.config.subgraphSpacing;

    // For each component, calculate where it would be positioned based on its root node
    componentLayouts.forEach((compLayout, index) => {
      if (!compLayout.rootNode) {
        // Fallback: if no root node found, use origin
        compLayout.x = 0;
        compLayout.y = 0;
        return;
      }

      // Find where the root node is positioned in the layout
      // The layout positions are relative to (0,0), so we need to find the root's offset
      let rootPosInLayout = { x: 0, y: 0 };

      // Search through all branch layouts to find the root node's position
      for (const branchLayout of compLayout.branchLayouts) {
        const rootPos = branchLayout.layout.positions.get(
          compLayout.rootNode.id
        );
        if (rootPos) {
          rootPosInLayout = {
            x: rootPos.x + branchLayout.offsetX,
            y: rootPos.y + branchLayout.offsetY,
          };
          break;
        }
      }

      // Calculate component position so that root node stays at its current position
      // If root is at (rootPosInLayout.x, rootPosInLayout.y) in the layout,
      // and we want it to be at (rootNode.x, rootNode.y) in world space,
      // then the component offset should be:
      compLayout.x = compLayout.rootNode.x - rootPosInLayout.x;
      compLayout.y = compLayout.rootNode.y - rootPosInLayout.y;

      console.log(
        `Component ${index + 1}: Root node "${compLayout.rootNode.title}" at (${
          compLayout.rootNode.x
        }, ${compLayout.rootNode.y}), ` +
          `layout offset (${rootPosInLayout.x}, ${rootPosInLayout.y}), ` +
          `component position (${compLayout.x}, ${compLayout.y})`
      );
    });

    // Now check for overlaps and adjust positions if necessary
    const occupiedRects = [];

    for (let i = 0; i < componentLayouts.length; i++) {
      const comp = componentLayouts[i];

      const compRect = {
        x: comp.x,
        y: comp.y,
        width: comp.width,
        height: comp.height,
      };

      // Check if this component overlaps with any already placed components
      if (this.rectsOverlap(compRect, occupiedRects, spacing)) {
        console.log(`Component ${i + 1} overlaps, finding new position...`);

        // Find a new position that doesn't overlap
        const bestPos = this.findBestPosition(comp, occupiedRects, spacing);
        comp.x = bestPos.x;
        comp.y = bestPos.y;

        compRect.x = comp.x;
        compRect.y = comp.y;
      }

      occupiedRects.push(compRect);
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
   * Split a connected component into the branches that can each be laid out as
   * their own tree.
   *
   * The tree layout hangs everything off ONE root and only covers that root's
   * backward cone, so a component with several sinks used to lose every node
   * outside the chosen cone - they were never given a position at all and simply
   * kept their pre-arrange coordinates. Partitioning by sink cone here means each
   * sink gets its own tree and every node is placed.
   *
   * Cones are claimed in priority order and a node joins the first cone that
   * wants it. That keeps each residual a valid tree: if Y is in cone i and some
   * node on Y's path to sink i had been claimed by an earlier cone j, then Y
   * would reach sink j too and would itself have been claimed by j. So the whole
   * path stays in the residual, and the sink is the only node in it with no
   * consumer - exactly what findRootNode looks for.
   */
  findIndependentBranches(nodeIds, graph) {
    const inSet = new Set(nodeIds);
    const sinks = nodeIds.filter((id) => {
      const data = graph.get(id);
      return data && !data.outputs.some((out) => inSet.has(out));
    });

    // The overwhelmingly common case, and byte-identical to the old behaviour.
    if (sinks.length <= 1) return [nodeIds];

    // Full cones first, then claim. Sizing the cones after claiming would make
    // the order depend on itself.
    const coneOf = new Map();
    for (const sink of sinks) {
      const cone = new Set([sink]);
      const stack = [sink];
      while (stack.length > 0) {
        const current = stack.pop();
        for (const input of graph.get(current)?.inputs || []) {
          if (!inSet.has(input) || cone.has(input)) continue;
          cone.add(input);
          stack.push(input);
        }
      }
      coneOf.set(sink, cone);
    }

    const ordered = [...sinks].sort((a, b) => {
      const aTerminal = this.isTerminalNode(graph.get(a)?.node) ? 1 : 0;
      const bTerminal = this.isTerminalNode(graph.get(b)?.node) ? 1 : 0;
      if (aTerminal !== bTerminal) return bTerminal - aTerminal;
      const sizeDelta = coneOf.get(b).size - coneOf.get(a).size;
      if (sizeDelta !== 0) return sizeDelta;
      // Node id last, so the result never depends on where anything sits.
      return a < b ? -1 : a > b ? 1 : 0;
    });

    const claimed = new Set();
    const branches = [];
    for (const sink of ordered) {
      // Sink first, so findRootNode meets it on its first iteration.
      const residual = [sink];
      claimed.add(sink);
      for (const id of coneOf.get(sink)) {
        if (id === sink || claimed.has(id)) continue;
        claimed.add(id);
        residual.push(id);
      }
      branches.push(residual);
    }

    // A node in no cone reaches no sink, which means it sits on a cycle. Keep it
    // in the layout as its own branch rather than dropping it - findRootNode
    // returns null for it and hierarchicalBottomUpLayout falls back to
    // traditionalLayout, which places everything.
    const orphans = nodeIds.filter((id) => !claimed.has(id));
    if (orphans.length > 0) branches.push(orphans);

    return branches;
  }

  /**
   * Replace each comment's members with a single stand-in node, so the layout
   * treats the section as one unit and the comment box ends up tight around it.
   *
   * Without this the layout only ever sees individual nodes: two halves of one
   * comment get packed wherever they fit, the box stretches to reach both, and on
   * the way it swallows whatever it stretched over.
   *
   * A comment can only be contracted if its member set is *convex* - no path
   * leaves the set and comes back. A non-convex set has a non-member that must be
   * drawn between two members, so contracting it would make the quotient graph
   * cyclic and no layout could keep the box tight anyway. Those are left alone
   * and reported by `csg lint` as nonConvexComment.
   */
  contractComments(graph, snapshot) {
    // Innermost first, so an outer comment contracts over its children's
    // stand-ins rather than over their raw members.
    const entries = [...snapshot.entries]
      .filter((e) => !e.frozen)
      .sort((a, b) => b.depth - a.depth || a.comment.id - b.comment.id);

    const unsafe = this.commentsWithTangledMembership(entries);

    let nextClusterId = -1;

    for (const entry of entries) {
      if (unsafe.has(entry)) continue;
      // Members that are still in the graph, with any already-contracted child
      // comment standing in for its own members.
      const members = new Set();
      for (const node of entry.nodes) {
        const clusterId = this.clusterOwnerOf?.get(node.id);
        if (clusterId !== undefined) members.add(clusterId);
        else if (graph.has(node.id)) members.add(node.id);
      }
      if (members.size < 2) continue;
      if (!this.isConvexSet(members, graph)) continue;

      const clusterId = nextClusterId--;
      const interior = this.layoutNodeSet([...members], graph);
      if (!interior || interior.positions.size === 0) continue;

      // Reserve the comment's own box, not just the nodes': the padding and the
      // title/description band are part of what has to fit on the canvas. Then
      // the refit lands exactly inside the rect the packer set aside, so a
      // contracted comment cannot collide with anything.
      const box = this.bp.commentRectForContent(
        { minX: 0, minY: 0, maxX: interior.width, maxY: interior.height },
        { description: entry.comment.description },
      );

      this.clusters.set(clusterId, {
        comment: entry.comment,
        members,
        interior,
        width: box.width,
        height: box.height,
        // Where the members sit inside the reserved rect.
        insetX: -box.x,
        insetY: -box.y,
      });

      this.absorbIntoCluster(graph, clusterId, members);

      this.clusterOwnerOf ??= new Map();
      for (const id of members) {
        this.clusterOwnerOf.set(id, clusterId);
        // Anything the child cluster already owned now answers to this one.
        const nested = this.clusters.get(id);
        if (nested) {
          for (const inner of nested.members) {
            this.clusterOwnerOf.set(inner, clusterId);
          }
        }
      }
      for (const node of entry.nodes) this.clusterOwnerOf.set(node.id, clusterId);
    }
  }

  /**
   * Comments that must not be contracted because they share a node with another
   * comment that does not contain them.
   *
   * Nesting is fine - an inner comment's nodes belong to its parent by
   * definition. Two *unrelated* boxes holding the same node are not: neither can
   * be laid out as a block without the other following it, their boxes have to
   * overlap, and the separation pass cannot pull them apart either.
   *
   * Left uncontracted these behave as they did before clustering existed, which
   * is merely untidy. Contracted, they feed the next arrange a different
   * membership than the last one produced and the layout stops settling - press
   * the shortcut twice, get two answers. `csg lint` reports the pair as
   * multiCommentedNode.
   */
  commentsWithTangledMembership(entries) {
    const isAncestor = (maybeAncestor, entry) => {
      const byComment = new Map(entries.map((e) => [e.comment, e]));
      let current = entry.parent;
      while (current) {
        if (current === maybeAncestor.comment) return true;
        current = byComment.get(current)?.parent;
      }
      return false;
    };

    const owners = new Map();
    for (const entry of entries) {
      for (const node of entry.nodes) {
        if (!owners.has(node)) owners.set(node, []);
        owners.get(node).push(entry);
      }
    }

    const unsafe = new Set();
    for (const holders of owners.values()) {
      if (holders.length < 2) continue;
      for (let i = 0; i < holders.length; i++) {
        for (let j = i + 1; j < holders.length; j++) {
          const a = holders[i];
          const b = holders[j];
          if (isAncestor(a, b) || isAncestor(b, a)) continue;
          unsafe.add(a);
          unsafe.add(b);
        }
      }
    }
    return unsafe;
  }

  // A set is convex when no path leaves it and comes back. Step one hop outside
  // from every member, then walk forwards: reaching a member from out there means
  // that member's producer and consumer have an outsider between them.
  //
  // A direct member-to-member edge is not a violation, so those are not followed.
  isConvexSet(members, graph) {
    const seen = new Set();
    const stack = [];
    const escape = (id) => {
      if (members.has(id) || seen.has(id) || !graph.has(id)) return;
      seen.add(id);
      stack.push(id);
    };

    for (const member of members) {
      for (const out of graph.get(member)?.outputs || []) escape(out);
    }

    while (stack.length > 0) {
      const id = stack.pop();
      for (const out of graph.get(id)?.outputs || []) {
        if (members.has(out)) return false;
        escape(out);
      }
    }

    return true;
  }

  // Swap the members out of the graph for one stand-in that inherits every wire
  // crossing the cluster boundary.
  absorbIntoCluster(graph, clusterId, members) {
    const entry = {
      node: null,
      clusterId,
      inputs: [],
      outputs: [],
      inputConnections: [],
      outputConnections: [],
    };

    for (const id of members) {
      const data = graph.get(id);
      if (!data) continue;
      for (const source of data.inputs) {
        if (!members.has(source)) entry.inputs.push(source);
      }
      for (const target of data.outputs) {
        if (!members.has(target)) entry.outputs.push(target);
      }
      graph.delete(id);
    }

    // Redirect the outside world's references to the members onto the stand-in.
    for (const data of graph.values()) {
      data.inputs = data.inputs.map((id) => (members.has(id) ? clusterId : id));
      data.outputs = data.outputs.map((id) =>
        members.has(id) ? clusterId : id,
      );
      for (const conn of data.inputConnections) {
        if (members.has(conn.nodeId)) conn.nodeId = clusterId;
      }
      for (const conn of data.outputConnections) {
        if (members.has(conn.nodeId)) conn.nodeId = clusterId;
      }
    }

    graph.set(clusterId, entry);
  }

  /**
   * Lay out a set of node ids as a self-contained block: split it into connected
   * components, split each of those into branches, and pack the result.
   *
   * The top level of autoArrange does this to the whole graph; a contracted
   * comment does it to its own interior, which is why a comment holding two
   * unconnected sections still comes out as one tidy block.
   */
  layoutNodeSet(nodeIds, graph) {
    const layouts = [];
    const inSet = new Set(nodeIds);
    const visited = new Set();

    for (const id of nodeIds) {
      if (visited.has(id) || !graph.has(id)) continue;
      // Weakly connected component, restricted to this set.
      const component = [];
      const stack = [id];
      visited.add(id);
      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        const data = graph.get(current);
        if (!data) continue;
        for (const neighbour of [...data.inputs, ...data.outputs]) {
          if (!inSet.has(neighbour) || visited.has(neighbour)) continue;
          visited.add(neighbour);
          stack.push(neighbour);
        }
      }

      const branches = this.findIndependentBranches(component, graph);
      let offsetY = 0;
      let width = 0;
      const parts = [];
      for (const branch of branches) {
        const layout = this.layoutComponent(branch, graph);
        parts.push({ layout, offsetY });
        offsetY += layout.height + this.config.branchSpacing;
        width = Math.max(width, layout.width);
      }
      layouts.push({
        parts,
        width,
        height: Math.max(0, offsetY - this.config.branchSpacing),
        x: 0,
        y: 0,
      });
    }

    if (layouts.length === 0) return null;
    layouts.sort((a, b) => b.width * b.height - a.width * a.height);
    this.packComponents(layouts);

    const positions = new Map();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const block of layouts) {
      for (const part of block.parts) {
        part.layout.positions.forEach((pos, nodeId) => {
          const x = pos.x + block.x;
          const y = pos.y + block.y + part.offsetY;
          positions.set(nodeId, { x, y });
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + this.nodeWidthOf(nodeId));
          maxY = Math.max(maxY, y + this.nodeHeightOf(nodeId));
        });
      }
    }

    const normalized = new Map();
    positions.forEach((pos, nodeId) => {
      normalized.set(nodeId, { x: pos.x - minX, y: pos.y - minY });
    });
    return {
      positions: normalized,
      width: maxX - minX,
      height: maxY - minY,
    };
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
    return this.normalizeLayout(this.hierarchicalBottomUpLayout(subgraph, graph));
  }

  // Shift a finished layout so its top-left corner is the origin, and measure it
  // from the actual node rects.
  //
  // arrangeBranchWithChildren anchors the parent's right edge at x = 0 and grows
  // leftwards, so raw positions run from -width to 0 - while packComponents and
  // the branch stacker both reserve the rect [x, x + width]. The reserved area was
  // therefore a full component-width to the right of where the nodes actually
  // landed, so two packed components could be placed straight through each other.
  // Normalising here fixes the packer, the branch stacker and the camera framing
  // in one place, and is what lets a contracted comment report an honest size.
  normalizeLayout(layout) {
    if (!layout?.positions || layout.positions.size === 0) return layout;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    layout.positions.forEach((pos, nodeId) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + this.nodeWidthOf(nodeId));
      maxY = Math.max(maxY, pos.y + this.nodeHeightOf(nodeId));
    });

    const positions = new Map();
    layout.positions.forEach((pos, nodeId) => {
      positions.set(nodeId, { x: pos.x - minX, y: pos.y - minY });
    });

    return { positions, width: maxX - minX, height: maxY - minY };
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
        // Deduplicate in case the same node is connected to multiple input ports
        const childrenRaw =
          subgraph.get(nodeId)?.inputs.filter((id) => subgraph.has(id)) || [];
        const children = [...new Set(childrenRaw)];

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
            bbox: {
              x: 0,
              y: 0,
              width: this.nodeWidthOf(nodeId),
              height: this.nodeHeightOf(nodeId),
            },
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
    // The node the whole layout hangs off: the graph's terminal node if it has
    // one, otherwise any node nothing else consumes.
    let root = null;
    let fallback = null;

    for (const [nodeId, data] of subgraph) {
      if (this.isTerminalNode(data.node)) {
        // First match wins. This used to be a forEach with a bare `return`,
        // which continues rather than breaking, so the *last* terminal node was
        // picked instead.
        root = nodeId;
        break;
      }

      const outputsInSubgraph = data.outputs.filter((id) => subgraph.has(id));
      if (outputsInSubgraph.length === 0 && fallback === null) {
        fallback = nodeId;
      }
    }

    return root !== null ? root : fallback;
  }

  // Sizes come from one place so that a contracted comment - which is a whole
  // subgraph standing in for a node, and nothing like 200x100 - measures the same
  // everywhere the layout asks. Also indexes nodes by id: the arrangement inner
  // loops used to bp.nodes.find() per comparison, which is quadratic in a hot path.
  beginLayoutSession() {
    this.nodeIndex = new Map(this.bp.nodes.map((n) => [n.id, n]));
    this.clusters = new Map();
    this.clusterOwnerOf = new Map();
  }

  nodeRecordOf(nodeId) {
    if (this.nodeIndex) return this.nodeIndex.get(nodeId) || null;
    return this.bp.nodes.find((n) => n.id === nodeId) || null;
  }

  nodeWidthOf(nodeId) {
    const cluster = this.clusters?.get(nodeId);
    if (cluster) return cluster.width;
    return this.nodeRecordOf(nodeId)?.width ?? 200;
  }

  nodeHeightOf(nodeId) {
    const cluster = this.clusters?.get(nodeId);
    if (cluster) return cluster.height;
    const node = this.nodeRecordOf(nodeId);
    return node?.height ?? this.estimateNodeHeight(node);
  }

  // The node a graph is read towards. Function and loopBody graphs end in a
  // "Function Output" boundary node rather than "Output", and autoArrangeAllGraphs
  // arranges those too - recognising only "Output" let a stray sink win the root
  // election there.
  isTerminalNode(node) {
    if (!node) return false;
    const typeName = node.nodeType?.name;
    return (
      node.title === "Output" ||
      typeName === "Output" ||
      typeName === "Function Output"
    );
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

    const customEditorOffset = node.nodeType?.hasCustomEditor
      ? (node.nodeType?.customEditorConfig?.height || 38) + 28
      : 0;

    const startY = 50 + dropdownOffset + customInputOffset + customEditorOffset;

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
   * Find ALL connections between a child and parent node
   * Returns an array of {parentInputIndex, childOutputIndex} for each connection
   */
  findAllConnectedPorts(parentNode, childNode, subgraph) {
    const connections = [];

    if (!parentNode || !childNode) {
      return connections;
    }

    // Search through CHILD's output ports (child provides data to parent)
    childNode.outputPorts?.forEach((outputPort, outIdx) => {
      outputPort.connections?.forEach((wire) => {
        // Wire has startPort and endPort
        // Since this is an output port, it's the startPort
        const connectedPort = wire.endPort;
        if (connectedPort && connectedPort.node.id === parentNode.id) {
          // Find which input port on the parent
          parentNode.inputPorts?.forEach((inputPort, inIdx) => {
            if (inputPort === connectedPort) {
              connections.push({
                parentInputIndex: inIdx,
                childOutputIndex: outIdx,
              });
            }
          });
        }
      });
    });

    return connections;
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

    // Real width, not a flat 200: pills are 120 and regular nodes 180, and a
    // contracted comment is as wide as the section inside it.
    const nodeWidth = this.nodeWidthOf(nodeId);
    const nodeHeight =
      this.clusters?.get(nodeId)?.height ?? this.estimateNodeHeight(node);

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
    if (childLayouts.length === 1) {
      horizontalSpacing = 30; // Single leaf child: just enough to see the wire
    } else if (totalNodesInChildren <= 2) {
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
    // SPECIAL CASE: All children are variable pills - align each to its port
    const childOffsets = [];
    const placedBBoxes = []; // Track placed bounding boxes for overlap detection

    const overlapMargin = 5; // Extra margin for overlap detection to prevent tight fits

    // Check if all children are variable pills (single-node, isVariable)
    const allChildrenArePills = childLayouts.every((child) => {
      const childNode = this.bp.nodes.find((n) => n.id === child.id);
      return childNode?.isVariable && child.layout.nodes?.length === 1;
    });

    if (allChildrenArePills && childLayouts.length > 1) {
      console.log(
        `   🎯 All ${childLayouts.length} children are pills - aligning to ports`
      );

      // Position each pill directly in front of its corresponding input port
      childLayouts.forEach((child, index) => {
        const childNode = subgraph.get(child.id)?.node;
        const portInfo = this.findConnectedPorts(node, childNode, subgraph);

        if (portInfo) {
          // Calculate the Y position to align with the parent's input port
          const parentPortY = this.getPortYPosition(
            node,
            portInfo.parentInputIndex,
            false // INPUT port on parent
          );

          // Position the pill at the port's Y position (centered on the port)
          const pillHeight = childNode?.height || 35;
          const proposedY = parentPortY - pillHeight / 2;

          childOffsets.push({
            x: 0,
            y: proposedY,
            width: child.layout.bbox.width,
          });

          // Track bbox for final layout calculation
          placedBBoxes.push({
            x: child.layout.bbox.x,
            y: proposedY + child.layout.bbox.y,
            width: child.layout.bbox.width,
            height: child.layout.bbox.height,
          });

          console.log(
            `   ✅ Pill ${index} (${childNode?.title}) aligned to port ${
              portInfo.parentInputIndex
            } at y=${proposedY.toFixed(1)}`
          );
        } else {
          console.warn(
            `   ⚠️ Could not find port connection for pill ${index}`
          );
          // Fallback to default positioning
          childOffsets.push({
            x: 0,
            y: index * 50,
            width: child.layout.bbox.width,
          });
          placedBBoxes.push({
            x: child.layout.bbox.x,
            y: index * 50 + child.layout.bbox.y,
            width: child.layout.bbox.width,
            height: child.layout.bbox.height,
          });
        }
      });
    } else {
      // Normal positioning logic for non-pill children or mixed children

      // Helper function to calculate max depth of a child's subtree
      // TODO
      const getMaxDepth = (childLayout) => {
        if (!childLayout.nodes || childLayout.nodes.length <= 1) {
          return 0; // Leaf node
        }

        // Count the maximum depth by looking at the layout structure
        // We can approximate this by counting unique X positions (layers)
        const xPositions = new Set();
        childLayout.positions.forEach((pos) => {
          xPositions.add(Math.round(pos.x / 10) * 10); // Round to nearest 10 to group similar positions
        });

        return Math.max(0, xPositions.size - 1); // -1 because we count layers, not nodes
      };

      // Removed debug logging for cleaner output

      childLayouts.forEach((child, index) => {
        const childLayout = child.layout;
        const childNode = subgraph.get(child.id)?.node;

        // Calculate vertical spacing based on the maximum depth of current and previous children
        const currentChildDepth = getMaxDepth(childLayout);
        let maxDepth = currentChildDepth;

        if (index > 0) {
          const prevChildDepth = getMaxDepth(childLayouts[index - 1].layout);
          maxDepth = Math.max(currentChildDepth, prevChildDepth);
        }

        const verticalSpacing =
          this.config.childrenGapBase +
          maxDepth * this.config.childrenGapPerLevel;

        // Smart initial placement: try to place below previous siblings
        let proposedY = 0;

        if (index > 0) {
          // First, try to place this child just below the previous child's NODE (not full tree)
          // This allows for better packing when the previous child has a wide tree
          const prevChild = childLayouts[index - 1];
          const prevChildNode = this.bp.nodes.find(
            (n) => n.id === prevChild.id
          );

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

        // SPECIAL CASE: If this is a single child, align by port(s)
        if (childLayouts.length === 1 && childNode) {
          const allConnections = this.findAllConnectedPorts(
            node,
            childNode,
            subgraph
          );

          if (allConnections.length > 0) {
            // Get the child node's position within its own layout
            const childPosInLayout = childLayout.positions.get(child.id);

            if (childPosInLayout) {
              if (allConnections.length === 1) {
                // Single connection - align ports directly
                const portInfo = allConnections[0];
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

                proposedY = parentPortY - childPosInLayout.y - childPortY;
              } else {
                // Multiple connections - align to center of all parent ports
                let totalParentPortY = 0;
                allConnections.forEach((conn) => {
                  totalParentPortY += this.getPortYPosition(
                    node,
                    conn.parentInputIndex,
                    false // INPUT port on parent
                  );
                });
                const avgParentPortY = totalParentPortY / allConnections.length;

                // Use the first child output port for alignment
                // (or could average child ports too, but typically it's one output to many inputs)
                const childPortY = this.getPortYPosition(
                  childNode,
                  allConnections[0].childOutputIndex,
                  true // OUTPUT port on child
                );

                proposedY = avgParentPortY - childPosInLayout.y - childPortY;
              }
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
        const actualChildWidth = this.nodeWidthOf(child.id);

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
        const childBaseX =
          childNodeRightEdge - childNodePos.x - actualChildWidth;

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
              // Get the actual placed child node to check its width
              const actualPlacedChildWidth = this.nodeWidthOf(
                childLayouts[i].id
              );

              const placedChildNodeRightEdge = -nodeWidth - horizontalSpacing;
              const placedChildBaseX =
                placedChildNodeRightEdge -
                placedChildNodePos.x -
                actualPlacedChildWidth;

              // Get ALL nodes in the placed child's tree with ACTUAL positions
              const nodesToCheck = [];
              placedChildLayout.positions.forEach((pos, nodeId) => {
                const node = this.nodeRecordOf(nodeId);
                if (node || this.clusters?.has(nodeId)) {
                  nodesToCheck.push({
                    nodeId,
                    nodeName: node?.nodeType?.name || `Node ${nodeId}`,
                    x: placedChildBaseX + pos.x,
                    y: placedChildOffset.y + pos.y,
                    width: this.nodeWidthOf(nodeId),
                    height: this.nodeHeightOf(nodeId),
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
    } // End of else block for normal positioning

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

      const actualChildWidth = this.nodeWidthOf(child.id);

      // The child node itself should be positioned with its RIGHT edge at -(nodeWidth + horizontalSpacing)
      // For right-alignment: all nodes' right edges should align regardless of their width
      // childNodePos.x is the child node's X within its layout (relative to layout origin)
      // We want: childBaseX + childNodePos.x + actualChildWidth = -(nodeWidth + horizontalSpacing)
      // Therefore: childBaseX = -(nodeWidth + horizontalSpacing) - childNodePos.x - actualChildWidth
      const childNodeRightEdge = -nodeWidth - horizontalSpacing;
      const childBaseX = childNodeRightEdge - childNodePos.x - actualChildWidth;

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

    // Check if this is a variable node (pill-shaped)
    // Variable nodes: no inputs, has outputs, and no special UI elements
    const isVariable =
      node.nodeType?.inputs?.length === 0 &&
      node.nodeType?.outputs?.length > 0 &&
      !node.nodeType?.hasOperation &&
      !node.nodeType?.hasCustomInput &&
      !node.nodeType?.hasVariableDropdown &&
      !node.nodeType?.hasCustomEditor;

    // Variable nodes are small and pill-shaped
    if (isVariable) {
      return 35;
    }

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

    const customEditorOffset = node.nodeType?.hasCustomEditor
      ? (node.nodeType?.customEditorConfig?.height || 38) + 28
      : 0;
    height += customEditorOffset;

    // Add variable dropdown offset if present
    const variableDropdownOffset = node.nodeType?.hasVariableDropdown ? 45 : 0;
    height += variableDropdownOffset;

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
      // A contracted comment expands here: its interior was laid out once, in its
      // own coordinates, and is dropped in wherever the stand-in landed. The
      // inset skips the padding and title band the reserved rect includes.
      // Recursive, so a comment nested in a comment unpacks too.
      const cluster = this.clusters?.get(nodeId);
      if (cluster) {
        this.applyLayout(
          cluster.interior,
          pos.x + offsetX + cluster.insetX,
          pos.y + offsetY + cluster.insetY,
        );
        return;
      }

      const node = this.nodeRecordOf(nodeId);
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
