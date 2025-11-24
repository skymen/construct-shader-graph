/**
 * HistoryManager - Snapshot-based undo/redo system with intelligent change coalescing
 */
export class HistoryManager {
  constructor(blueprint, options = {}) {
    this.blueprint = blueprint;
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
    this.maxUndoSteps = options.maxUndoSteps || 50;

    // Change coalescing
    this.lastChangeTime = 0;
    this.lastChangedProperties = new Set();
    this.changeCoalesceTime = options.changeCoalesceTime || 1000; // 1 second
    this.isApplyingUndoRedo = false;
  }

  /**
   * Push current state to undo stack with automatic change detection and coalescing
   */
  pushState(description = "State Change") {
    if (this.isApplyingUndoRedo) return;

    const currentTime = Date.now();
    const newState = this.blueprint.exportState();

    // Initialize if first push
    if (!this.currentState) {
      this.currentState = newState;
      this.lastChangeTime = currentTime;
      this.lastChangedProperties = new Set();
      console.log("Initialized undo system with current state");
      return;
    }

    // Calculate diff
    const diff = this.calculateStateDiff(this.currentState, newState);
    const changedProperties = diff.changedProperties;

    // No changes? Skip
    if (changedProperties.size === 0) {
      console.log("No changes detected, skipping undo push");
      return;
    }

    // Check if we should coalesce
    const timeSinceLastChange = currentTime - this.lastChangeTime;
    const shouldCoalesce =
      timeSinceLastChange < this.changeCoalesceTime &&
      this.undoStack.length > 0 &&
      this.redoStack.length === 0 &&
      this.propertySetsOverlap(changedProperties, this.lastChangedProperties);

    if (shouldCoalesce) {
      // Update existing entry
      const lastUndo = this.undoStack[this.undoStack.length - 1];
      lastUndo.afterState = newState;
      lastUndo.timestamp = currentTime;

      // Merge changed properties
      changedProperties.forEach((prop) => lastUndo.changedProperties.add(prop));

      // Update diff (preserve old values, update new values)
      this.mergeDiff(lastUndo.diff, diff);

      console.log(
        `Coalesced: ${description} (${changedProperties.size} properties)`
      );
    } else {
      // Create new entry
      const undoEntry = {
        description: description,
        beforeState: this.currentState,
        afterState: newState,
        timestamp: currentTime,
        changedProperties: new Set(changedProperties),
        diff: diff,
      };

      this.undoStack.push(undoEntry);

      // Limit stack size
      if (this.undoStack.length > this.maxUndoSteps) {
        this.undoStack.shift();
      }

      console.log(
        `Pushed: ${description} (${changedProperties.size} properties)`
      );
    }

    // Clear redo stack
    this.redoStack = [];

    // Update tracking
    this.currentState = newState;
    this.lastChangeTime = currentTime;
    this.lastChangedProperties = changedProperties;

    this.blueprint.updateUndoRedoButtons();
  }

  /**
   * Calculate diff between two states
   */
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
      settingsChanged: false,
      changedProperties: new Set(),
    };

    // Build maps for efficient comparison
    const oldNodes = new Map(oldState.nodes.map((n) => [n.id, n]));
    const newNodes = new Map(newState.nodes.map((n) => [n.id, n]));

    // Find added nodes
    newNodes.forEach((node, id) => {
      if (!oldNodes.has(id)) {
        diff.nodesAdded.push(node);
        diff.changedProperties.add(`node:${id}:created`);
      }
    });

    // Find removed nodes
    oldNodes.forEach((node, id) => {
      if (!newNodes.has(id)) {
        diff.nodesRemoved.push(node);
        diff.changedProperties.add(`node:${id}:deleted`);
      }
    });

    // Find modified nodes
    oldNodes.forEach((oldNode, id) => {
      const newNode = newNodes.get(id);
      if (newNode) {
        const nodeDiff = this.calculateNodeDiff(oldNode, newNode);
        if (nodeDiff.hasChanges) {
          diff.nodesModified.push({
            id: id,
            changes: nodeDiff.changes,
          });
          nodeDiff.changedKeys.forEach((key) => {
            diff.changedProperties.add(`node:${id}:${key}`);
          });
        }
      }
    });

    // Compare wires
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

    // Compare comments
    const oldComments = new Map(oldState.comments.map((c) => [c.id, c]));
    const newComments = new Map(newState.comments.map((c) => [c.id, c]));

    // Find added comments
    newComments.forEach((comment, id) => {
      if (!oldComments.has(id)) {
        diff.commentsAdded.push(comment);
        diff.changedProperties.add(`comment:${id}:created`);
      }
    });

    // Find removed comments
    oldComments.forEach((comment, id) => {
      if (!newComments.has(id)) {
        diff.commentsRemoved.push(comment);
        diff.changedProperties.add(`comment:${id}:deleted`);
      }
    });

    // Find modified comments
    oldComments.forEach((oldComment, id) => {
      const newComment = newComments.get(id);
      if (newComment) {
        const commentDiff = this.calculateCommentDiff(oldComment, newComment);
        if (commentDiff.hasChanges) {
          diff.commentsModified.push({
            id: id,
            changes: commentDiff.changes,
          });
          commentDiff.changedKeys.forEach((key) => {
            diff.changedProperties.add(`comment:${id}:${key}`);
          });
        }
      }
    });

    // Compare uniforms
    if (!this.deepEqual(oldState.uniforms, newState.uniforms)) {
      diff.uniformsChanged = true;
      diff.changedProperties.add("uniforms:changed");
    }

    // Compare custom nodes
    if (!this.deepEqual(oldState.customNodes, newState.customNodes)) {
      diff.customNodesChanged = true;
      diff.changedProperties.add("customNodes:changed");
    }

    // Compare settings
    if (!this.deepEqual(oldState.shaderSettings, newState.shaderSettings)) {
      diff.settingsChanged = true;
      diff.changedProperties.add("settings:changed");
    }

    return diff;
  }

  /**
   * Calculate diff for a single node
   */
  calculateNodeDiff(oldNode, newNode) {
    const diff = {
      hasChanges: false,
      changes: {},
      changedKeys: [],
    };

    // Compare simple properties
    ["x", "y", "operation", "customInput", "uniformId"].forEach((key) => {
      if (!this.deepEqual(oldNode[key], newNode[key])) {
        diff.hasChanges = true;
        diff.changes[key] = {
          oldValue: oldNode[key],
          newValue: newNode[key],
        };
        diff.changedKeys.push(key);
      }
    });

    // Compare input port values
    oldNode.inputPorts.forEach((oldPort, i) => {
      const newPort = newNode.inputPorts[i];
      if (newPort && !this.deepEqual(oldPort.value, newPort.value)) {
        diff.hasChanges = true;
        diff.changes[`inputPort:${i}:value`] = {
          oldValue: oldPort.value,
          newValue: newPort.value,
        };
        diff.changedKeys.push(`inputPort:${i}:value`);
      }
    });

    return diff;
  }

  /**
   * Calculate diff for a single comment
   */
  calculateCommentDiff(oldComment, newComment) {
    const diff = {
      hasChanges: false,
      changes: {},
      changedKeys: [],
    };

    // Compare simple properties
    ["x", "y", "width", "height", "title", "description", "color"].forEach((key) => {
      if (!this.deepEqual(oldComment[key], newComment[key])) {
        diff.hasChanges = true;
        diff.changes[key] = {
          oldValue: oldComment[key],
          newValue: newComment[key],
        };
        diff.changedKeys.push(key);
      }
    });

    return diff;
  }

  /**
   * Convert wire to string for comparison
   */
  wireToString(wire) {
    const rerouteStr =
      wire.rerouteNodes.length > 0 ? `:r${wire.rerouteNodes.length}` : "";
    return `${wire.startNodeId}:${wire.startPortIndex}->${wire.endNodeId}:${wire.endPortIndex}${rerouteStr}`;
  }

  /**
   * Check if two sets of properties overlap
   */
  propertySetsOverlap(set1, set2) {
    for (const prop of set1) {
      if (set2.has(prop)) return true;
    }
    return false;
  }

  /**
   * Merge new diff into existing diff (for coalescing)
   */
  mergeDiff(existingDiff, newDiff) {
    // Merge nodesModified (preserve old values, update new values)
    const existingModified = new Map(
      existingDiff.nodesModified.map((n) => [n.id, n])
    );

    newDiff.nodesModified.forEach((newMod) => {
      const existing = existingModified.get(newMod.id);
      if (existing) {
        // Update: preserve oldValue, update newValue
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

    // Merge commentsModified (same logic as nodesModified)
    const existingCommentsModified = new Map(
      existingDiff.commentsModified.map((c) => [c.id, c])
    );

    newDiff.commentsModified.forEach((newMod) => {
      const existing = existingCommentsModified.get(newMod.id);
      if (existing) {
        // Update: preserve oldValue, update newValue
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

    // Merge other changes
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
    existingDiff.settingsChanged =
      existingDiff.settingsChanged || newDiff.settingsChanged;
  }

  /**
   * Deep equality check
   */
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

  /**
   * Undo the last change
   */
  undo() {
    if (this.undoStack.length === 0) {
      console.log("Nothing to undo");
      return false;
    }

    const undoEntry = this.undoStack.pop();

    // Store for redo
    this.redoStack.push(undoEntry);

    // Apply before state
    this.isApplyingUndoRedo = true;
    try {
      this.blueprint.loadState(undoEntry.beforeState);
      this.currentState = undoEntry.beforeState;
      console.log(`Undid: ${undoEntry.description}`);
      return true;
    } catch (error) {
      console.error("Failed to undo:", error);
      return false;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  /**
   * Redo the last undone change
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log("Nothing to redo");
      return false;
    }

    const redoEntry = this.redoStack.pop();

    // Store back in undo
    this.undoStack.push(redoEntry);

    // Apply after state
    this.isApplyingUndoRedo = true;
    try {
      this.blueprint.loadState(redoEntry.afterState);
      this.currentState = redoEntry.afterState;
      console.log(`Redid: ${redoEntry.description}`);
      return true;
    } catch (error) {
      console.error("Failed to redo:", error);
      return false;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  /**
   * Clear undo/redo history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
    this.lastChangeTime = 0;
    this.lastChangedProperties = new Set();
    console.log("Cleared undo/redo history");
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo/redo info for debugging
   */
  getInfo() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStack: this.undoStack.map((entry) => ({
        description: entry.description,
        timestamp: entry.timestamp,
        changedPropertyCount: entry.changedProperties.size,
      })),
      redoStack: this.redoStack.map((entry) => ({
        description: entry.description,
        timestamp: entry.timestamp,
        changedPropertyCount: entry.changedProperties.size,
      })),
    };
  }
}
