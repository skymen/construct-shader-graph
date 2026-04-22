/**
 * HistoryManager — Unified host-level undo/redo system.
 *
 * A single instance lives on BlueprintSystem. Every undo/redo entry records
 * which graph(s) were affected and their before/after snapshots. On undo/redo,
 * the editor switches to the graph where the change originated.
 */
export class HistoryManager {
  constructor(host, options = {}) {
    this.host = host;
    this.undoStack = [];
    this.redoStack = [];
    this.currentStates = new Map(); // graphId → state snapshot
    this.maxUndoSteps = options.maxUndoSteps || 50;

    // Change coalescing
    this.lastChangeTime = 0;
    this.lastChangedProperties = new Set();
    this.changeCoalesceTime = options.changeCoalesceTime || 1000;
    this.isApplyingUndoRedo = false;
  }

  // Backward-compat: reading/writing `this.history.currentState` maps to
  // the active graph's entry in `currentStates`.
  get currentState() {
    const gId = this.host.activeGraphId;
    return gId ? this.currentStates.get(gId) : null;
  }

  set currentState(val) {
    const gId = this.host.activeGraphId;
    if (gId) this.currentStates.set(gId, val);
  }

  initGraphState(graphId, state) {
    this.currentStates.set(graphId, state);
  }

  removeGraphState(graphId) {
    this.currentStates.delete(graphId);
  }

  /**
   * Push current state to undo stack with automatic change detection and coalescing.
   * Always captures the currently active graph.
   */
  pushState(description = "State Change") {
    if (this.isApplyingUndoRedo) return;

    const graphId = this.host.activeGraphId;
    const graph = this.host.graphs.get(graphId);
    if (!graph) return;

    const currentTime = Date.now();
    const newState = this.host._exportGraphState(graph);

    const oldState = this.currentStates.get(graphId);
    if (!oldState) {
      this.currentStates.set(graphId, newState);
      this.lastChangeTime = currentTime;
      this.lastChangedProperties = new Set();
      console.log("Initialized undo system with current state");
      return;
    }

    const diff = this.calculateStateDiff(oldState, newState);
    const changedProperties = diff.changedProperties;

    if (changedProperties.size === 0) {
      console.log("No changes detected, skipping undo push");
      return;
    }

    const timeSinceLastChange = currentTime - this.lastChangeTime;
    const shouldCoalesce =
      timeSinceLastChange < this.changeCoalesceTime &&
      this.undoStack.length > 0 &&
      this.redoStack.length === 0 &&
      this.propertySetsOverlap(changedProperties, this.lastChangedProperties);

    if (shouldCoalesce) {
      const lastUndo = this.undoStack[this.undoStack.length - 1];
      // Only coalesce single-graph entries targeting the same graph
      if (lastUndo.graphs.length === 1 && lastUndo.graphs[0].graphId === graphId) {
        lastUndo.graphs[0].afterState = newState;
        lastUndo.timestamp = currentTime;
        changedProperties.forEach((prop) => lastUndo.changedProperties.add(prop));
        this.mergeDiff(lastUndo.graphs[0].diff, diff);
        console.log(
          `Coalesced: ${description} (${changedProperties.size} properties)`
        );
      } else {
        this._pushNewEntry(description, graphId, oldState, newState, diff, currentTime);
        console.log(
          `Pushed: ${description} (${changedProperties.size} properties)`
        );
      }
    } else {
      this._pushNewEntry(description, graphId, oldState, newState, diff, currentTime);
      console.log(
        `Pushed: ${description} (${changedProperties.size} properties)`
      );
    }

    this.redoStack = [];
    this.currentStates.set(graphId, newState);
    this.lastChangeTime = currentTime;
    this.lastChangedProperties = changedProperties;

    this.host.updateUndoRedoButtons();
  }

  _pushNewEntry(description, graphId, oldState, newState, diff, timestamp) {
    const entry = {
      description,
      primaryGraphId: graphId,
      graphs: [{ graphId, beforeState: oldState, afterState: newState, diff }],
      timestamp,
      changedProperties: new Set(diff.changedProperties),
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
  }

  /**
   * Run a multi-graph transaction: snapshot listed graphs before `fn()`,
   * then push a single unified undo entry covering all changed graphs.
   */
  runTransaction(graphIds, fn, description = "Transaction") {
    if (this.isApplyingUndoRedo) return;

    const snapshots = new Map();
    for (const id of graphIds) {
      const g = this.host.graphs.get(id);
      if (!g) continue;
      snapshots.set(id, this.currentStates.get(id) || this.host._exportGraphState(g));
    }

    fn();

    const graphEntries = [];
    const changedProperties = new Set();
    let primaryGraphId = null;

    for (const [id, beforeState] of snapshots) {
      const g = this.host.graphs.get(id);
      if (!g) continue;
      const afterState = this.host._exportGraphState(g);
      const diff = this.calculateStateDiff(beforeState, afterState);
      if (diff.changedProperties.size === 0) continue;

      if (!primaryGraphId) primaryGraphId = id;
      graphEntries.push({ graphId: id, beforeState, afterState, diff });
      diff.changedProperties.forEach((p) => changedProperties.add(p));
      this.currentStates.set(id, afterState);
    }

    if (graphEntries.length === 0) return;

    const entry = {
      description,
      primaryGraphId,
      graphs: graphEntries,
      timestamp: Date.now(),
      changedProperties,
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastChangeTime = Date.now();
    this.lastChangedProperties = changedProperties;

    try { this.host.updateUndoRedoButtons && this.host.updateUndoRedoButtons(); } catch {}
  }

  /**
   * Undo the last change. Restores all graphs in the entry and switches the
   * editor to the graph where the change originated.
   */
  undo() {
    if (this.undoStack.length === 0) {
      console.log("Nothing to undo");
      return false;
    }

    const entry = this.undoStack.pop();
    this.redoStack.push(entry);

    this.isApplyingUndoRedo = true;
    try {
      // Callable graphs (function/loopBody) own contracts that callers depend
      // on — restore them first so callers rebuild with the correct layout.
      const sorted = [...entry.graphs].sort((a, b) => {
        const gA = this.host.graphs.get(a.graphId);
        const gB = this.host.graphs.get(b.graphId);
        const aCallable = (gA?.kind === "function" || gA?.kind === "loopBody") ? 0 : 1;
        const bCallable = (gB?.kind === "function" || gB?.kind === "loopBody") ? 0 : 1;
        return aCallable - bCallable;
      });

      for (const ge of sorted) {
        const graph = this.host.graphs.get(ge.graphId);
        if (!graph) continue;
        this.host._loadGraphState(graph, ge.beforeState);
        this.currentStates.set(ge.graphId, ge.beforeState);
      }

      if (entry.primaryGraphId && this.host.graphs.has(entry.primaryGraphId)) {
        this.host.setActiveGraph(entry.primaryGraphId);
      }

      // _loadGraphState only fires onShaderChanged for the main graph, but
      // function/loopBody changes also affect codegen. Fire once after all
      // graphs are restored so the preview reflects the final state.
      try { this.host.onShaderChanged && this.host.onShaderChanged(); } catch {}

      console.log(`Undid: ${entry.description}`);
      return { success: true, description: entry.description };
    } catch (error) {
      console.error("Failed to undo:", error);
      return false;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  /**
   * Redo the last undone change. Restores all graphs and switches to the
   * originating graph.
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log("Nothing to redo");
      return false;
    }

    const entry = this.redoStack.pop();
    this.undoStack.push(entry);

    this.isApplyingUndoRedo = true;
    try {
      const sorted = [...entry.graphs].sort((a, b) => {
        const gA = this.host.graphs.get(a.graphId);
        const gB = this.host.graphs.get(b.graphId);
        const aCallable = (gA?.kind === "function" || gA?.kind === "loopBody") ? 0 : 1;
        const bCallable = (gB?.kind === "function" || gB?.kind === "loopBody") ? 0 : 1;
        return aCallable - bCallable;
      });

      for (const ge of sorted) {
        const graph = this.host.graphs.get(ge.graphId);
        if (!graph) continue;
        this.host._loadGraphState(graph, ge.afterState);
        this.currentStates.set(ge.graphId, ge.afterState);
      }

      if (entry.primaryGraphId && this.host.graphs.has(entry.primaryGraphId)) {
        this.host.setActiveGraph(entry.primaryGraphId);
      }

      try { this.host.onShaderChanged && this.host.onShaderChanged(); } catch {}

      console.log(`Redid: ${entry.description}`);
      return { success: true, description: entry.description };
    } catch (error) {
      console.error("Failed to redo:", error);
      return false;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentStates = new Map();
    this.lastChangeTime = 0;
    this.lastChangedProperties = new Set();
    console.log("Cleared undo/redo history");
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // ---- Diff / comparison utilities (unchanged) ----

  calculateStateDiff(oldState, newState) {
    const diff = {
      nodesAdded: [],
      nodesRemoved: [],
      nodesModified: [],
      wiresAdded: [],
      wiresRemoved: [],
      commentsAdded: [],
      commentsRemoved: [],
      commentsModified: [],
      uniformsChanged: false,
      customNodesChanged: false,
      contractChanged: false,
      settingsChanged: false,
      changedProperties: new Set(),
    };

    const oldNodes = new Map(oldState.nodes.map((n) => [n.id, n]));
    const newNodes = new Map(newState.nodes.map((n) => [n.id, n]));

    newNodes.forEach((node, id) => {
      if (!oldNodes.has(id)) {
        diff.nodesAdded.push(node);
        diff.changedProperties.add(`node:${id}:created`);
      }
    });

    oldNodes.forEach((node, id) => {
      if (!newNodes.has(id)) {
        diff.nodesRemoved.push(node);
        diff.changedProperties.add(`node:${id}:deleted`);
      }
    });

    oldNodes.forEach((oldNode, id) => {
      const newNode = newNodes.get(id);
      if (newNode) {
        const nodeDiff = this.calculateNodeDiff(oldNode, newNode);
        if (nodeDiff.hasChanges) {
          diff.nodesModified.push({ id, changes: nodeDiff.changes });
          nodeDiff.changedKeys.forEach((key) => {
            diff.changedProperties.add(`node:${id}:${key}`);
          });
        }
      }
    });

    const oldWires = oldState.wires.map((w) => this.wireToString(w));
    const newWires = newState.wires.map((w) => this.wireToString(w));

    oldWires.forEach((wireStr) => {
      if (!newWires.includes(wireStr)) {
        diff.wiresRemoved.push(wireStr);
        diff.changedProperties.add(`wire:${wireStr}:deleted`);
      }
    });

    newWires.forEach((wireStr) => {
      if (!oldWires.includes(wireStr)) {
        diff.wiresAdded.push(wireStr);
        diff.changedProperties.add(`wire:${wireStr}:created`);
      }
    });

    const oldComments = new Map(oldState.comments.map((c) => [c.id, c]));
    const newComments = new Map(newState.comments.map((c) => [c.id, c]));

    newComments.forEach((comment, id) => {
      if (!oldComments.has(id)) {
        diff.commentsAdded.push(comment);
        diff.changedProperties.add(`comment:${id}:created`);
      }
    });

    oldComments.forEach((comment, id) => {
      if (!newComments.has(id)) {
        diff.commentsRemoved.push(comment);
        diff.changedProperties.add(`comment:${id}:deleted`);
      }
    });

    oldComments.forEach((oldComment, id) => {
      const newComment = newComments.get(id);
      if (newComment) {
        const commentDiff = this.calculateCommentDiff(oldComment, newComment);
        if (commentDiff.hasChanges) {
          diff.commentsModified.push({ id, changes: commentDiff.changes });
          commentDiff.changedKeys.forEach((key) => {
            diff.changedProperties.add(`comment:${id}:${key}`);
          });
        }
      }
    });

    if (!this.deepEqual(oldState.uniforms, newState.uniforms)) {
      diff.uniformsChanged = true;
      diff.changedProperties.add("uniforms:changed");
    }

    if (!this.deepEqual(oldState.customNodes, newState.customNodes)) {
      diff.customNodesChanged = true;
      diff.changedProperties.add("customNodes:changed");
    }

    if (!this.deepEqual(oldState.shaderSettings, newState.shaderSettings)) {
      diff.settingsChanged = true;
      diff.changedProperties.add("settings:changed");
    }

    if (!this.deepEqual(oldState.data, newState.data)) {
      diff.contractChanged = true;
      diff.changedProperties.add("contract:changed");
    }

    return diff;
  }

  calculateNodeDiff(oldNode, newNode) {
    const diff = { hasChanges: false, changes: {}, changedKeys: [] };

    ["x", "y", "operation", "customInput", "uniformId", "data"].forEach((key) => {
      if (!this.deepEqual(oldNode[key], newNode[key])) {
        diff.hasChanges = true;
        diff.changes[key] = { oldValue: oldNode[key], newValue: newNode[key] };
        diff.changedKeys.push(key);
      }
    });

    if (oldNode.inputPorts.length !== newNode.inputPorts.length) {
      diff.hasChanges = true;
      diff.changes["inputPorts:count"] = {
        oldValue: oldNode.inputPorts.length,
        newValue: newNode.inputPorts.length,
      };
      diff.changedKeys.push("inputPorts:count");
    }
    if (oldNode.outputPorts && newNode.outputPorts && oldNode.outputPorts.length !== newNode.outputPorts.length) {
      diff.hasChanges = true;
      diff.changes["outputPorts:count"] = {
        oldValue: oldNode.outputPorts.length,
        newValue: newNode.outputPorts.length,
      };
      diff.changedKeys.push("outputPorts:count");
    }

    oldNode.inputPorts.forEach((oldPort, i) => {
      const newPort = newNode.inputPorts[i];
      if (!newPort) return;
      if (!this.deepEqual(oldPort.value, newPort.value)) {
        diff.hasChanges = true;
        diff.changes[`inputPort:${i}:value`] = {
          oldValue: oldPort.value,
          newValue: newPort.value,
        };
        diff.changedKeys.push(`inputPort:${i}:value`);
      }
      if (oldPort.name !== newPort.name || oldPort.portType !== newPort.portType) {
        diff.hasChanges = true;
        diff.changes[`inputPort:${i}:meta`] = {
          oldValue: { name: oldPort.name, type: oldPort.portType },
          newValue: { name: newPort.name, type: newPort.portType },
        };
        diff.changedKeys.push(`inputPort:${i}:meta`);
      }
    });

    return diff;
  }

  calculateCommentDiff(oldComment, newComment) {
    const diff = { hasChanges: false, changes: {}, changedKeys: [] };

    ["x", "y", "width", "height", "title", "description", "color"].forEach(
      (key) => {
        if (!this.deepEqual(oldComment[key], newComment[key])) {
          diff.hasChanges = true;
          diff.changes[key] = {
            oldValue: oldComment[key],
            newValue: newComment[key],
          };
          diff.changedKeys.push(key);
        }
      }
    );

    return diff;
  }

  wireToString(wire) {
    const rerouteStr =
      wire.rerouteNodes.length > 0 ? `:r${wire.rerouteNodes.length}` : "";
    return `${wire.startNodeId}:${wire.startPortIndex}->${wire.endNodeId}:${wire.endPortIndex}${rerouteStr}`;
  }

  propertySetsOverlap(set1, set2) {
    for (const prop of set1) {
      if (set2.has(prop)) return true;
    }
    return false;
  }

  mergeDiff(existingDiff, newDiff) {
    const existingModified = new Map(
      existingDiff.nodesModified.map((n) => [n.id, n])
    );

    newDiff.nodesModified.forEach((newMod) => {
      const existing = existingModified.get(newMod.id);
      if (existing) {
        Object.entries(newMod.changes).forEach(([key, change]) => {
          if (existing.changes[key]) {
            existing.changes[key].newValue = change.newValue;
          } else {
            existing.changes[key] = change;
          }
        });
      } else {
        existingDiff.nodesModified.push(newMod);
      }
    });

    const existingCommentsModified = new Map(
      existingDiff.commentsModified.map((c) => [c.id, c])
    );

    newDiff.commentsModified.forEach((newMod) => {
      const existing = existingCommentsModified.get(newMod.id);
      if (existing) {
        Object.entries(newMod.changes).forEach(([key, change]) => {
          if (existing.changes[key]) {
            existing.changes[key].newValue = change.newValue;
          } else {
            existing.changes[key] = change;
          }
        });
      } else {
        existingDiff.commentsModified.push(newMod);
      }
    });

    existingDiff.nodesAdded.push(...newDiff.nodesAdded);
    existingDiff.nodesRemoved.push(...newDiff.nodesRemoved);
    existingDiff.wiresAdded.push(...newDiff.wiresAdded);
    existingDiff.wiresRemoved.push(...newDiff.wiresRemoved);
    existingDiff.commentsAdded.push(...newDiff.commentsAdded);
    existingDiff.commentsRemoved.push(...newDiff.commentsRemoved);

    existingDiff.uniformsChanged =
      existingDiff.uniformsChanged || newDiff.uniformsChanged;
    existingDiff.customNodesChanged =
      existingDiff.customNodesChanged || newDiff.customNodesChanged;
    existingDiff.contractChanged =
      existingDiff.contractChanged || newDiff.contractChanged;
    existingDiff.settingsChanged =
      existingDiff.settingsChanged || newDiff.settingsChanged;
  }

  deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      if (Array.isArray(a) !== Array.isArray(b)) return false;

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.deepEqual(a[i], b[i])) return false;
        }
        return true;
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }

  getInfo() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStack: this.undoStack.map((entry) => ({
        description: entry.description,
        timestamp: entry.timestamp,
        primaryGraphId: entry.primaryGraphId,
        graphCount: entry.graphs.length,
        changedPropertyCount: entry.changedProperties.size,
      })),
      redoStack: this.redoStack.map((entry) => ({
        description: entry.description,
        timestamp: entry.timestamp,
        primaryGraphId: entry.primaryGraphId,
        graphCount: entry.graphs.length,
        changedPropertyCount: entry.changedProperties.size,
      })),
    };
  }
}
