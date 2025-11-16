// Blueprint Node System
import {
  NODE_TYPES,
  PORT_TYPES,
  areTypesCompatible,
  isGenericType,
  getAllowedTypesForGeneric,
  toShaderValue,
} from "./nodes/index.js";
import { UniformFloatNode } from "./nodes/UniformFloatNode.js";
import { UniformColorNode } from "./nodes/UniformColorNode.js";
import JSZip from "jszip";

// Import boilerplate files as raw text
import boilerplateWebGL1 from "./shaders/boilerplate-webgl1.glsl?raw";
import boilerplateWebGL2 from "./shaders/boilerplate-webgl2.glsl?raw";
import boilerplateWebGPU from "./shaders/boilerplate-webgpu.wgsl?raw";

class Port {
  constructor(node, type, index, portDef) {
    this.node = node;
    this.type = type; // 'input' or 'output'
    this.index = index;
    this.connections = [];
    this.radius = 8;
    this.portType = portDef.type; // The data type (float, vector, etc.)
    this.name = portDef.name;

    // Store value for editable input ports
    // Custom types are never editable as their type can change dynamically
    const portTypeInfo = PORT_TYPES[this.portType];
    if (
      type === "input" &&
      portTypeInfo?.editable &&
      this.portType !== "custom"
    ) {
      this.value = portTypeInfo.defaultValue;
      this.isEditable = true;
    } else {
      this.isEditable = false;
    }
  }

  getPosition() {
    const node = this.node;

    // For variable nodes, output port is centered in the header
    if (node.isVariable && this.type === "output") {
      return {
        x: node.x + node.width,
        y: node.y + node.height / 2,
      };
    }

    const x = this.type === "input" ? node.x : node.x + node.width;

    // Add extra offset if node has operation dropdown
    const dropdownOffset = node.nodeType.hasOperation ? 30 : 0;
    // Add extra offset if node has custom input
    const hasLabel =
      node.nodeType.hasCustomInput && node.nodeType.customInputConfig.label;
    const customInputOffset = node.nodeType.hasCustomInput
      ? hasLabel
        ? 45
        : 30
      : 0;
    const startY = node.y + 50 + dropdownOffset + customInputOffset;

    // Calculate cumulative Y position based on actual port heights
    let y = startY;
    const ports = this.type === "input" ? node.inputPorts : node.outputPorts;

    for (let i = 0; i < this.index; i++) {
      const port = ports[i];
      // Get the extra height needed for this port's value box
      const extraHeight = port.getExtraHeight();
      y += 40 + extraHeight; // Base spacing + extra height
    }

    return { x, y };
  }

  // Get extra height needed for this port's value box (beyond the standard 20px)
  getExtraHeight() {
    if (
      !this.isEditable ||
      this.type !== "input" ||
      this.connections.length > 0
    ) {
      return 0;
    }

    const resolvedType = this.getResolvedType();

    // Vec3 and vec4 need extra height when showing raw values (2 rows instead of 1)
    if (resolvedType === "vec3" || resolvedType === "vec4") {
      const inRange =
        this.value &&
        Array.isArray(this.value) &&
        this.value.every((v) => v >= 0 && v <= 1);

      // If showing raw values (not color swatch), we need extra height
      // Height is 41px (2 rows of 20px + 1px gap), standard port spacing accounts for 20px
      // So we need 21px extra
      return inRange ? 0 : 21;
    }

    return 0;
  }

  getValueBoxBounds(ctx) {
    if (!this.isEditable || this.type !== "input") return null;
    const pos = this.getPosition();
    const resolvedType = this.getResolvedType();

    // Determine width and height based on type
    let width = 50;
    let height = 20;

    let offsetX = 0;
    let offsetY = 0;

    if (resolvedType === "vec2") {
      width = 71; // Two boxes side by side (2 * 35 + 1)
      height = 20;
    } else if (resolvedType === "vec3") {
      // Check if values are in range to determine if showing color or text
      const inRange =
        this.value &&
        Array.isArray(this.value) &&
        this.value.every((v) => v >= 0 && v <= 1);
      width = inRange ? 50 : 71; // Color swatch or 2x2 grid
      height = inRange ? 20 : 41; // Color swatch or 2 rows (2 * 20 + 1)
      offsetY = inRange ? 0 : 11;
    } else if (resolvedType === "vec4") {
      // Check if values are in range to determine if showing color or text
      const inRange =
        this.value &&
        Array.isArray(this.value) &&
        this.value.every((v) => v >= 0 && v <= 1);
      width = inRange ? 50 : 71; // Color swatch or 2x2 grid
      height = inRange ? 20 : 41; // Color swatch or 2 rows (2 * 20 + 1)
      offsetY = inRange ? 0 : 11;
    }

    // Measure the actual label width
    let labelWidth = 30; // Default fallback
    if (ctx) {
      ctx.save();
      ctx.font = "12px sans-serif";
      labelWidth = ctx.measureText(this.name).width + 5; // Add small padding
      ctx.restore();
    }

    return {
      x: pos.x + 15 + labelWidth + offsetX,
      y: pos.y - height / 2 + offsetY,
      width,
      height,
    };
  }

  isPointInValueBox(px, py, ctx) {
    const bounds = this.getValueBoxBounds(ctx);
    if (!bounds) return false;
    return (
      px >= bounds.x &&
      px <= bounds.x + bounds.width &&
      py >= bounds.y &&
      py <= bounds.y + bounds.height
    );
  }

  isPointInside(px, py) {
    const pos = this.getPosition();
    const dx = px - pos.x;
    const dy = py - pos.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
  }

  // Get the actual type of this port (resolved if generic or custom)
  getResolvedType() {
    // Handle custom types
    if (this.portType === "custom") {
      if (this.node.nodeType.getCustomType) {
        return this.node.nodeType.getCustomType(this.node, this);
      }
      return "float"; // Fallback
    }

    if (isGenericType(this.portType)) {
      return this.node.resolveGenericType(this.portType) || this.portType;
    }
    return this.portType;
  }

  getColor() {
    const resolvedType = this.getResolvedType();
    return PORT_TYPES[resolvedType]?.color || PORT_TYPES.any.color;
  }

  canConnectTo(otherPort) {
    // Can't connect to same type (input to input, output to output)
    if (this.type === otherPort.type) return false;
    // Can't connect to same node
    if (this.node === otherPort.node) return false;

    // Determine which is output and which is input
    const outputPort = this.type === "output" ? this : otherPort;
    const inputPort = this.type === "input" ? this : otherPort;

    // Get resolved types
    const outputResolvedType = outputPort.getResolvedType();
    const inputResolvedType = inputPort.getResolvedType();

    // For custom types, always pass the resolved type
    // For generic types, pass resolved type if it's different from the port type
    const outputTypeToCheck =
      outputPort.portType === "custom"
        ? outputResolvedType
        : outputResolvedType !== outputPort.portType
        ? outputResolvedType
        : null;

    const inputTypeToCheck =
      inputPort.portType === "custom"
        ? inputResolvedType
        : inputResolvedType !== inputPort.portType
        ? inputResolvedType
        : null;

    // Check type compatibility using the new system with resolved types
    return areTypesCompatible(
      outputPort.portType,
      inputPort.portType,
      outputTypeToCheck,
      inputTypeToCheck
    );
  }

  // Update editability based on resolved type (for generic types)
  updateEditability() {
    if (this.type !== "input") return;

    // Custom types should never be editable as their type can change dynamically
    if (this.portType === "custom") {
      this.isEditable = false;
      return;
    }

    const resolvedType = this.getResolvedType();
    const portTypeInfo = PORT_TYPES[resolvedType];

    // If the resolved type is editable and we don't have connections, make it editable
    if (portTypeInfo?.editable && this.connections.length === 0) {
      if (!this.isEditable) {
        this.isEditable = true;
        // Initialize value if not already set
        if (this.value === undefined) {
          this.value = portTypeInfo.defaultValue;
        }
      }
    } else if (this.connections.length > 0) {
      // If we have connections, we're not editable
      this.isEditable = false;
    } else if (!portTypeInfo?.editable && this.isEditable) {
      // If the resolved type is no longer editable, clear the value and mark as non-editable
      this.isEditable = false;
      this.value = undefined;
    }
  }
}

class Node {
  constructor(x, y, id, nodeType) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.nodeType = nodeType;
    this.title = nodeType.name;
    this.headerColor = nodeType.color;
    this.isVariable =
      nodeType.inputs.length === 0 && nodeType.outputs.length > 0;
    this.isSelected = false;

    // Initialize operation for nodes that have it
    if (nodeType.hasOperation) {
      this.operation = nodeType.operationOptions[0].value;
    }

    // Initialize custom input for nodes that have it
    if (nodeType.hasCustomInput) {
      this.customInput = nodeType.customInputConfig.defaultValue;
    }

    // Track resolved generic types (e.g., { T: "float" })
    this.resolvedGenerics = {};

    // Create ports based on node type definition
    this.inputPorts = nodeType.inputs.map(
      (inputDef, index) => new Port(this, "input", index, inputDef)
    );
    this.outputPorts = nodeType.outputs.map(
      (outputDef, index) => new Port(this, "output", index, outputDef)
    );

    // Variable nodes are smaller and pill-shaped
    if (this.isVariable) {
      this.width = 120;
      this.height = 35;
    } else {
      this.width = 180;
      // Calculate height based on number of ports and their extra heights
      const maxPorts = Math.max(
        this.inputPorts.length,
        this.outputPorts.length
      );

      // Calculate extra height from input ports' value boxes
      let extraHeight = 0;
      this.inputPorts.forEach((port) => {
        extraHeight += port.getExtraHeight();
      });

      // Add extra space for operation dropdown if node has operations
      const dropdownSpace = nodeType.hasOperation ? 30 : 0;
      // Add extra space for custom input if node has it
      const hasLabel =
        nodeType.hasCustomInput && nodeType.customInputConfig.label;
      const customInputSpace = nodeType.hasCustomInput
        ? hasLabel
          ? 45
          : 30
        : 0;
      this.height =
        50 +
        dropdownSpace +
        customInputSpace +
        maxPorts * 40 +
        extraHeight +
        10;
    }

    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  isPointInside(px, py) {
    return (
      px >= this.x &&
      px <= this.x + this.width &&
      py >= this.y &&
      py <= this.y + this.height
    );
  }

  isPointInHeader(px, py) {
    // For variable nodes, the entire node is the header
    if (this.isVariable) {
      return this.isPointInside(px, py);
    }

    return (
      px >= this.x &&
      px <= this.x + this.width &&
      py >= this.y &&
      py <= this.y + 35
    );
  }

  getAllPorts() {
    return [...this.inputPorts, ...this.outputPorts];
  }

  // Recalculate node height based on current port states
  recalculateHeight() {
    if (this.isVariable) return; // Variable nodes have fixed height

    const maxPorts = Math.max(this.inputPorts.length, this.outputPorts.length);

    // Calculate extra height from input ports' value boxes
    let extraHeight = 0;
    this.inputPorts.forEach((port) => {
      extraHeight += port.getExtraHeight();
    });

    // Add extra space for operation dropdown if node has operations
    const dropdownSpace = this.nodeType.hasOperation ? 30 : 0;
    // Add extra space for custom input if node has it
    const hasLabel =
      this.nodeType.hasCustomInput && this.nodeType.customInputConfig.label;
    const customInputSpace = this.nodeType.hasCustomInput
      ? hasLabel
        ? 45
        : 30
      : 0;
    this.height =
      50 + dropdownSpace + customInputSpace + maxPorts * 40 + extraHeight + 10;
  }

  // Resolve generic type for a port based on connections
  resolveGenericType(genericType) {
    return this.resolvedGenerics[genericType] || null;
  }

  // Update resolved generic types based on a new connection
  updateResolvedGenerics(portType, concreteType) {
    if (isGenericType(portType) && !isGenericType(concreteType)) {
      // Set the generic to the concrete type
      this.resolvedGenerics[portType] = concreteType;
      return true;
    }
    return false;
  }

  // Clear resolved generics when all connections of a generic type are removed
  clearResolvedGeneric(genericType) {
    // Check if any ports with this generic type still have connections
    const hasConnections = this.getAllPorts().some(
      (port) => port.portType === genericType && port.connections.length > 0
    );

    if (!hasConnections) {
      delete this.resolvedGenerics[genericType];
    }
  }

  getOperationDropdownBounds() {
    if (!this.nodeType.hasOperation) return null;

    const headerHeight = 30;
    const dropdownHeight = 25;
    const padding = 10;
    const topMargin = 10; // Margin above the dropdown

    return {
      x: this.x + padding,
      y: this.y + headerHeight + topMargin,
      width: this.width - padding * 2,
      height: dropdownHeight,
    };
  }

  getCustomInputBounds() {
    if (!this.nodeType.hasCustomInput) return null;

    const headerHeight = 30;
    const inputHeight = 25;
    const padding = 10;
    const topMargin = 10; // Margin above the input

    // Add extra space for label if present
    const hasLabel = this.nodeType.customInputConfig.label;
    const labelHeight = hasLabel ? 15 : 0;

    // If there's also an operation dropdown, position below it
    const operationOffset = this.nodeType.hasOperation ? 35 : 0;

    return {
      x: this.x + padding,
      y: this.y + headerHeight + topMargin + operationOffset + labelHeight,
      width: this.width - padding * 2,
      height: inputHeight,
    };
  }

  // Update custom input and handle type changes
  updateCustomInput(newValue, editor) {
    const oldValue = this.customInput;
    this.customInput = newValue;

    // Check if any ports have custom types
    const customPorts = this.getAllPorts().filter(
      (port) => port.portType === "custom"
    );

    if (customPorts.length > 0 && this.nodeType.getCustomType) {
      // Get old and new types for each custom port
      customPorts.forEach((port) => {
        const oldNode = { ...this, customInput: oldValue };
        const newNode = { ...this, customInput: newValue };

        const oldType = this.nodeType.getCustomType(oldNode, port);
        const newType = this.nodeType.getCustomType(newNode, port);

        // If type changed, disconnect all connections
        if (oldType !== newType && port.connections.length > 0) {
          const connectionsToRemove = [...port.connections];
          connectionsToRemove.forEach((wire) => {
            editor.disconnectWire(wire);
          });
        }
      });
    }
  }

  // Get the resolved type of a connected input port
  getConnectedInputType(inputIndex) {
    const inputPort = this.inputPorts[inputIndex];
    if (!inputPort) return null;

    // Check if there's a connection
    if (inputPort.connections.length > 0) {
      const wire = inputPort.connections[0];
      const sourcePort = wire.startPort;
      if (sourcePort) {
        return sourcePort.getResolvedType();
      }
    }

    return null;
  }
}

class RerouteNode {
  constructor(x, y, wire, index) {
    this.x = x;
    this.y = y;
    this.wire = wire;
    this.index = index;
    this.radius = 6;
    this.isDragging = false;
    this.isSelected = false;
  }

  isPointInside(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius + 5; // Extra padding for easier clicking
  }
}

class Wire {
  constructor(startPort, endPort = null) {
    this.startPort = startPort;
    this.endPort = endPort;
    this.tempEndX = null;
    this.tempEndY = null;
    this.rerouteNodes = [];
  }

  getStartPos() {
    return this.startPort.getPosition();
  }

  getEndPos() {
    if (this.endPort) {
      return this.endPort.getPosition();
    }
    return { x: this.tempEndX, y: this.tempEndY };
  }

  addRerouteNode(x, y) {
    const node = new RerouteNode(x, y, this, this.rerouteNodes.length);
    this.rerouteNodes.push(node);
    return node;
  }

  removeRerouteNode(node) {
    const index = this.rerouteNodes.indexOf(node);
    if (index > -1) {
      this.rerouteNodes.splice(index, 1);
      // Update indices
      this.rerouteNodes.forEach((n, i) => {
        n.index = i;
      });
    }
  }

  getPoints() {
    const points = [this.getStartPos()];
    this.rerouteNodes.forEach((node) => {
      points.push({ x: node.x, y: node.y });
    });
    points.push(this.getEndPos());
    return points;
  }

  isPointNearWire(px, py, threshold = 10) {
    const points = this.getPoints();
    if (points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dist = this.pointToSegmentDistance(
        px,
        py,
        start.x,
        start.y,
        end.x,
        end.y
      );
      if (dist < threshold) {
        return { segmentIndex: i, distance: dist };
      }
    }
    return null;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class BlueprintSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nodes = [];
    this.wires = [];
    this.nodeIdCounter = 1;

    // Interaction state
    this.draggedNode = null;
    this.activeWire = null;
    this.hoveredPort = null;
    this.draggedRerouteNode = null;
    this.lastClickTime = 0;
    this.lastClickPos = { x: 0, y: 0 };
    this.editingPort = null;

    // Selection state
    this.selectedNodes = new Set();
    this.selectedRerouteNodes = new Set();
    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.boxSelectEnd = null;

    // Camera state
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
    };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // File System Access API support
    this.fileHandle = null;

    this.setupCanvas();

    // Shader settings
    this.shaderSettings = {
      name: "",
      version: "1.0.0.0",
      author: "",
      website: "",
      documentation: "",
      description: "",
      category: "color",
      blendsBackground: false,
      crossSampling: false,
      preservesOpaqueness: true,
      animated: false,
      isDeprecated: false,
      extendBoxH: 0,
      extendBoxV: 0,
    };

    // Uniforms
    this.uniforms = [];
    this.uniformIdCounter = 1;

    // Custom Nodes
    this.customNodes = [];
    this.customNodeIdCounter = 1;
    this.editingCustomNode = null;

    // Preview
    this.previewIframe = null;
    this.previewReady = false;
    this.previewNeedsUpdate = true;

    this.setupEventListeners();
    this.setupInputField();
    this.setupSearchMenu();
    this.setupShaderSettings();
    this.setupUniformSidebar();
    this.setupCustomNodeModal();
    this.setupPreview();
    this.render();
  }

  setupCanvas() {
    const resize = () => {
      const container = this.canvas.parentElement;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.render();
    };
    resize();
    window.addEventListener("resize", resize);
  }

  setupInputField() {
    // Create a hidden input field for editing port values
    this.inputField = document.createElement("input");
    this.inputField.type = "text";
    this.inputField.id = "portValueInput";
    this.inputField.style.position = "fixed";
    this.inputField.style.display = "none";
    document.body.appendChild(this.inputField);

    this.inputField.addEventListener("blur", () => {
      this.finishEditingPort();
    });

    this.inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.finishEditingPort();
      } else if (e.key === "Escape") {
        this.cancelEditingPort();
      }
    });

    // Prevent input from interfering with canvas events
    this.inputField.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    // Create custom input field for nodes with custom input
    this.customInputField = document.createElement("input");
    this.customInputField.type = "text";
    this.customInputField.id = "customInputField";
    this.customInputField.style.position = "fixed";
    this.customInputField.style.display = "none";
    this.customInputField.style.background = "#1a1a1a";
    this.customInputField.style.border = "2px solid #6ab0ff";
    this.customInputField.style.borderRadius = "4px";
    this.customInputField.style.color = "white";
    this.customInputField.style.padding = "4px 8px";
    this.customInputField.style.fontFamily = "monospace";
    this.customInputField.style.fontSize = "14px";
    document.body.appendChild(this.customInputField);

    this.customInputField.addEventListener("blur", () => {
      this.finishEditingCustomInput();
    });

    this.customInputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.finishEditingCustomInput();
      } else if (e.key === "Escape") {
        this.cancelEditingCustomInput();
      }
    });

    this.customInputField.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    // Create vec2 editor (two number inputs in a column)
    this.vec2Editor = document.createElement("div");
    this.vec2Editor.id = "vec2Editor";
    this.vec2Editor.style.position = "fixed";
    this.vec2Editor.style.display = "none";
    this.vec2Editor.style.background = "#1a1a1a";
    this.vec2Editor.style.border = "1px solid #4a4a4a";
    this.vec2Editor.style.borderRadius = "3px";
    this.vec2Editor.style.padding = "6px";
    this.vec2Editor.style.gap = "4px";
    this.vec2Editor.style.flexDirection = "column";
    this.vec2Editor.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">X</label>
        <input type="number" id="vec2X" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">Y</label>
        <input type="number" id="vec2Y" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
    `;
    document.body.appendChild(this.vec2Editor);

    this.vec2Editor.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add keydown listeners for vec2 inputs
    const setupVec2Listeners = () => {
      const vec2X = document.getElementById("vec2X");
      const vec2Y = document.getElementById("vec2Y");

      const handleVec2Keydown = (e) => {
        if (e.key === "Enter") {
          this.finishEditingPort();
        } else if (e.key === "Escape") {
          this.cancelEditingPort();
        }
      };

      vec2X.addEventListener("keydown", handleVec2Keydown);
      vec2Y.addEventListener("keydown", handleVec2Keydown);
      vec2X.addEventListener("mousedown", (e) => e.stopPropagation());
      vec2Y.addEventListener("mousedown", (e) => e.stopPropagation());
    };
    setupVec2Listeners();

    // Create vec3 editor (color picker + individual inputs)
    this.vec3Editor = document.createElement("div");
    this.vec3Editor.id = "vec3Editor";
    this.vec3Editor.style.position = "fixed";
    this.vec3Editor.style.display = "none";
    this.vec3Editor.style.background = "#1a1a1a";
    this.vec3Editor.style.border = "1px solid #4a4a4a";
    this.vec3Editor.style.borderRadius = "3px";
    this.vec3Editor.style.padding = "6px";
    this.vec3Editor.style.gap = "4px";
    this.vec3Editor.style.flexDirection = "column";
    this.vec3Editor.innerHTML = `
      <input type="color" id="vec3Color" style="width: 100px; height: 24px; border: 1px solid #3a3a3a; border-radius: 2px; cursor: pointer;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">R</label>
        <input type="number" id="vec3R" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">G</label>
        <input type="number" id="vec3G" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">B</label>
        <input type="number" id="vec3B" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
    `;
    document.body.appendChild(this.vec3Editor);

    this.vec3Editor.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add listeners for vec3 editor
    const setupVec3Listeners = () => {
      const vec3Color = document.getElementById("vec3Color");
      const vec3R = document.getElementById("vec3R");
      const vec3G = document.getElementById("vec3G");
      const vec3B = document.getElementById("vec3B");

      // Update number inputs when color changes
      vec3Color.addEventListener("input", () => {
        const hex = vec3Color.value;
        vec3R.value = (parseInt(hex.substr(1, 2), 16) / 255).toFixed(2);
        vec3G.value = (parseInt(hex.substr(3, 2), 16) / 255).toFixed(2);
        vec3B.value = (parseInt(hex.substr(5, 2), 16) / 255).toFixed(2);
      });

      // Update color picker when number inputs change
      const updateColorFromInputs = () => {
        const r = Math.round(parseFloat(vec3R.value || 0) * 255);
        const g = Math.round(parseFloat(vec3G.value || 0) * 255);
        const b = Math.round(parseFloat(vec3B.value || 0) * 255);
        vec3Color.value = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      };

      vec3R.addEventListener("input", updateColorFromInputs);
      vec3G.addEventListener("input", updateColorFromInputs);
      vec3B.addEventListener("input", updateColorFromInputs);

      const handleVec3Keydown = (e) => {
        if (e.key === "Enter") {
          this.finishEditingPort();
        } else if (e.key === "Escape") {
          this.cancelEditingPort();
        }
      };

      vec3R.addEventListener("keydown", handleVec3Keydown);
      vec3G.addEventListener("keydown", handleVec3Keydown);
      vec3B.addEventListener("keydown", handleVec3Keydown);

      vec3Color.addEventListener("mousedown", (e) => e.stopPropagation());
      vec3R.addEventListener("mousedown", (e) => e.stopPropagation());
      vec3G.addEventListener("mousedown", (e) => e.stopPropagation());
      vec3B.addEventListener("mousedown", (e) => e.stopPropagation());
    };
    setupVec3Listeners();

    // Create vec4 editor (color picker + individual inputs with alpha)
    this.vec4Editor = document.createElement("div");
    this.vec4Editor.id = "vec4Editor";
    this.vec4Editor.style.position = "fixed";
    this.vec4Editor.style.display = "none";
    this.vec4Editor.style.background = "#1a1a1a";
    this.vec4Editor.style.border = "1px solid #4a4a4a";
    this.vec4Editor.style.borderRadius = "3px";
    this.vec4Editor.style.padding = "6px";
    this.vec4Editor.style.gap = "4px";
    this.vec4Editor.style.flexDirection = "column";
    this.vec4Editor.innerHTML = `
      <input type="color" id="vec4Color" style="width: 100px; height: 24px; border: 1px solid #3a3a3a; border-radius: 2px; cursor: pointer;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">R</label>
        <input type="number" id="vec4R" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">G</label>
        <input type="number" id="vec4G" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">B</label>
        <input type="number" id="vec4B" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <label style="color: white; font-size: 11px; width: 12px;">A</label>
        <input type="number" id="vec4A" min="0" max="1" step="0.01" style="width: 70px; background: #2a2a2a; border: 1px solid #3a3a3a; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px;">
      </div>
    `;
    document.body.appendChild(this.vec4Editor);

    this.vec4Editor.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add listeners for vec4 editor
    const setupVec4Listeners = () => {
      const vec4Color = document.getElementById("vec4Color");
      const vec4R = document.getElementById("vec4R");
      const vec4G = document.getElementById("vec4G");
      const vec4B = document.getElementById("vec4B");
      const vec4A = document.getElementById("vec4A");

      // Update number inputs when color changes
      vec4Color.addEventListener("input", () => {
        const hex = vec4Color.value;
        vec4R.value = (parseInt(hex.substr(1, 2), 16) / 255).toFixed(2);
        vec4G.value = (parseInt(hex.substr(3, 2), 16) / 255).toFixed(2);
        vec4B.value = (parseInt(hex.substr(5, 2), 16) / 255).toFixed(2);
      });

      // Update color picker when number inputs change
      const updateColorFromInputs = () => {
        const r = Math.round(parseFloat(vec4R.value || 0) * 255);
        const g = Math.round(parseFloat(vec4G.value || 0) * 255);
        const b = Math.round(parseFloat(vec4B.value || 0) * 255);
        vec4Color.value = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      };

      vec4R.addEventListener("input", updateColorFromInputs);
      vec4G.addEventListener("input", updateColorFromInputs);
      vec4B.addEventListener("input", updateColorFromInputs);

      const handleVec4Keydown = (e) => {
        if (e.key === "Enter") {
          this.finishEditingPort();
        } else if (e.key === "Escape") {
          this.cancelEditingPort();
        }
      };

      vec4R.addEventListener("keydown", handleVec4Keydown);
      vec4G.addEventListener("keydown", handleVec4Keydown);
      vec4B.addEventListener("keydown", handleVec4Keydown);
      vec4A.addEventListener("keydown", handleVec4Keydown);

      vec4Color.addEventListener("mousedown", (e) => e.stopPropagation());
      vec4R.addEventListener("mousedown", (e) => e.stopPropagation());
      vec4G.addEventListener("mousedown", (e) => e.stopPropagation());
      vec4B.addEventListener("mousedown", (e) => e.stopPropagation());
      vec4A.addEventListener("mousedown", (e) => e.stopPropagation());
    };
    setupVec4Listeners();
  }

  setupSearchMenu() {
    this.searchMenu = document.getElementById("searchMenu");
    this.searchInput = document.getElementById("searchInput");
    this.searchResults = document.getElementById("searchResults");
    this.searchMenuPosition = { x: 0, y: 0 };
    this.searchFilterPort = null; // Port being dragged (for filtering)
    this.searchFilterType = null; // 'input' or 'output'

    // Search input handler
    this.searchInput.addEventListener("input", () => {
      this.updateSearchResults();
    });

    // Keyboard navigation
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideSearchMenu();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.focusNextSearchResult();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.focusPrevSearchResult();
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.selectFocusedSearchResult();
      }
    });

    // Click outside to close
    document.addEventListener("mousedown", (e) => {
      if (
        this.searchMenu.classList.contains("visible") &&
        !this.searchMenu.contains(e.target)
      ) {
        this.hideSearchMenu();
      }
    });

    // Prevent search menu clicks from propagating to canvas
    this.searchMenu.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }

  setupCollapsibleSections() {
    // Get all collapsible sections
    const sections = document.querySelectorAll(".collapsible-section");

    sections.forEach((section) => {
      const header = section.querySelector(".sidebar-section-header");
      const collapseBtn = section.querySelector(".collapse-btn");

      // Toggle collapse on header click
      header.addEventListener("click", (e) => {
        // Prevent toggle if clicking on interactive elements inside header
        if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") {
          return;
        }

        section.classList.toggle("collapsed");
      });

      // Also allow button click to toggle
      if (collapseBtn) {
        collapseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          section.classList.toggle("collapsed");
        });
      }
    });
  }

  setupShaderSettings() {
    // Setup collapsible functionality
    this.setupCollapsibleSections();

    // Get all setting input elements
    const nameInput = document.getElementById("settingName");
    const versionInput = document.getElementById("settingVersion");
    const authorInput = document.getElementById("settingAuthor");
    const websiteInput = document.getElementById("settingWebsite");
    const documentationInput = document.getElementById("settingDocumentation");
    const descriptionInput = document.getElementById("settingDescription");
    const categorySelect = document.getElementById("settingCategory");
    const blendsBackgroundCheckbox = document.getElementById(
      "settingBlendsBackground"
    );
    const crossSamplingCheckbox = document.getElementById(
      "settingCrossSampling"
    );
    const preservesOpaquenessCheckbox = document.getElementById(
      "settingPreservesOpaqueness"
    );
    const animatedCheckbox = document.getElementById("settingAnimated");
    const isDeprecatedCheckbox = document.getElementById("settingIsDeprecated");
    const extendBoxHInput = document.getElementById("settingExtendBoxH");
    const extendBoxVInput = document.getElementById("settingExtendBoxV");

    // Initialize values
    nameInput.value = this.shaderSettings.name;
    versionInput.value = this.shaderSettings.version;
    authorInput.value = this.shaderSettings.author;
    websiteInput.value = this.shaderSettings.website;
    documentationInput.value = this.shaderSettings.documentation;
    descriptionInput.value = this.shaderSettings.description;
    categorySelect.value = this.shaderSettings.category;
    blendsBackgroundCheckbox.checked = this.shaderSettings.blendsBackground;
    crossSamplingCheckbox.checked = this.shaderSettings.crossSampling;
    preservesOpaquenessCheckbox.checked =
      this.shaderSettings.preservesOpaqueness;
    animatedCheckbox.checked = this.shaderSettings.animated;
    isDeprecatedCheckbox.checked = this.shaderSettings.isDeprecated;
    extendBoxHInput.value = this.shaderSettings.extendBoxH;
    extendBoxVInput.value = this.shaderSettings.extendBoxV;

    // Name input
    nameInput.addEventListener("input", () => {
      this.shaderSettings.name = nameInput.value.trim();
    });

    // Version validation (X.X.X.X format)
    versionInput.addEventListener("blur", () => {
      const value = versionInput.value.trim();
      const versionPattern = /^\d+\.\d+\.\d+\.\d+$/;
      if (value && !versionPattern.test(value)) {
        alert("Version must follow X.X.X.X format (e.g., 1.0.0.0)");
        versionInput.value = this.shaderSettings.version;
      } else {
        this.shaderSettings.version = value || "1.0.0.0";
      }
    });

    // URL validation
    const validateURL = (input, settingKey) => {
      input.addEventListener("blur", () => {
        const value = input.value.trim();
        if (value) {
          try {
            new URL(value);
            this.shaderSettings[settingKey] = value;
          } catch {
            alert("Please enter a valid URL (e.g., https://example.com)");
            input.value = this.shaderSettings[settingKey];
          }
        } else {
          this.shaderSettings[settingKey] = "";
        }
      });
    };

    validateURL(websiteInput, "website");
    validateURL(documentationInput, "documentation");

    // Text inputs
    authorInput.addEventListener("input", () => {
      this.shaderSettings.author = authorInput.value;
    });

    descriptionInput.addEventListener("input", () => {
      this.shaderSettings.description = descriptionInput.value;
    });

    // Category select
    categorySelect.addEventListener("change", () => {
      this.shaderSettings.category = categorySelect.value;
    });

    // Checkboxes
    blendsBackgroundCheckbox.addEventListener("change", () => {
      this.shaderSettings.blendsBackground = blendsBackgroundCheckbox.checked;
      this.onShaderChanged();
    });

    crossSamplingCheckbox.addEventListener("change", () => {
      this.shaderSettings.crossSampling = crossSamplingCheckbox.checked;
      this.onShaderChanged();
    });

    preservesOpaquenessCheckbox.addEventListener("change", () => {
      this.shaderSettings.preservesOpaqueness =
        preservesOpaquenessCheckbox.checked;
      this.onShaderChanged();
    });

    animatedCheckbox.addEventListener("change", () => {
      this.shaderSettings.animated = animatedCheckbox.checked;
      this.onShaderChanged();
    });

    isDeprecatedCheckbox.addEventListener("change", () => {
      this.shaderSettings.isDeprecated = isDeprecatedCheckbox.checked;
      this.onShaderChanged();
    });

    // Extend box inputs
    extendBoxHInput.addEventListener("input", () => {
      this.shaderSettings.extendBoxH = parseFloat(extendBoxHInput.value) || 0;
      this.onShaderChanged();
    });

    extendBoxVInput.addEventListener("input", () => {
      this.shaderSettings.extendBoxV = parseFloat(extendBoxVInput.value) || 0;
      this.onShaderChanged();
    });
  }

  // Helper function to sanitize variable names
  sanitizeVariableName(name) {
    // Remove invalid characters and ensure it starts with a letter or underscore
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "");

    // If starts with a number, prepend underscore
    if (/^[0-9]/.test(sanitized)) {
      sanitized = "_" + sanitized;
    }

    // If empty after sanitization, return a default
    if (!sanitized) {
      sanitized = "uniform";
    }

    return sanitized;
  }

  // Helper function to validate variable names
  isValidVariableName(name) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  setupUniformSidebar() {
    this.uniformModal = document.getElementById("uniformModal");
    this.uniformNameInput = document.getElementById("uniformNameInput");
    this.uniformDescriptionInput = document.getElementById(
      "uniformDescriptionInput"
    );
    this.uniformTypeSelect = document.getElementById("uniformTypeSelect");
    this.uniformList = document.getElementById("uniform-list");

    // Add uniform button
    document.getElementById("addUniformBtn").addEventListener("click", () => {
      this.showUniformModal();
    });

    // Modal buttons
    document
      .getElementById("uniformModalCancel")
      .addEventListener("click", () => {
        this.hideUniformModal();
      });

    document.getElementById("uniformModalAdd").addEventListener("click", () => {
      this.addUniform();
    });

    // Close modal on outside click
    this.uniformModal.addEventListener("mousedown", (e) => {
      if (e.target === this.uniformModal) {
        this.hideUniformModal();
      }
    });

    // Enter key to add
    this.uniformNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.addUniform();
      } else if (e.key === "Escape") {
        this.hideUniformModal();
      }
    });

    // View Code Modal handlers
    const viewCodeModal = document.getElementById("viewCodeModal");

    document
      .getElementById("viewCodeModalClose")
      .addEventListener("click", () => {
        viewCodeModal.style.display = "none";
      });

    document.getElementById("viewCodeModalOk").addEventListener("click", () => {
      viewCodeModal.style.display = "none";
    });

    // Close modal on outside click
    viewCodeModal.addEventListener("mousedown", (e) => {
      if (e.target === viewCodeModal) {
        viewCodeModal.style.display = "none";
      }
    });

    // Tab switching
    document.querySelectorAll(".code-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.target;

        // Update active tab
        document
          .querySelectorAll(".code-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Update active panel
        document
          .querySelectorAll(".code-panel")
          .forEach((p) => p.classList.remove("active"));
        document.getElementById(`code-${target}`).classList.add("active");
      });
    });

    // Copy button
    document.getElementById("copyCodeBtn").addEventListener("click", () => {
      const activePanel = document.querySelector(".code-panel.active code");
      if (activePanel) {
        navigator.clipboard.writeText(activePanel.textContent).then(() => {
          const btn = document.getElementById("copyCodeBtn");
          const originalText = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        });
      }
    });
  }

  showUniformModal() {
    this.uniformNameInput.value = "";
    this.uniformDescriptionInput.value = "";
    this.uniformTypeSelect.value = "float";
    this.uniformModal.classList.add("visible");
    setTimeout(() => this.uniformNameInput.focus(), 0);
  }

  hideUniformModal() {
    this.uniformModal.classList.remove("visible");
  }

  addUniform() {
    const name = this.uniformNameInput.value.trim();
    const description = this.uniformDescriptionInput.value.trim();
    const type = this.uniformTypeSelect.value;

    if (!name) {
      alert("Please enter a uniform name");
      return;
    }

    // Generate variable name (sanitized version)
    let variableName = this.sanitizeVariableName(name);

    // Ensure variable name is unique (check both name and variableName)
    let counter = 1;
    const baseVariableName = variableName;
    while (
      this.uniforms.some((u) => u.variableName === variableName) ||
      this.uniforms.some((u) => u.name === variableName)
    ) {
      variableName = `${baseVariableName}_${counter}`;
      counter++;
    }

    const uniform = {
      id: this.uniformIdCounter++,
      name: name, // Display name (can be anything)
      variableName: variableName, // Sanitized name for shader code
      description: description,
      type: type, // 'float' or 'color'
      value: type === "color" ? { r: 1, g: 1, b: 1 } : 0.0,
      isPercent: false, // Only for float type
    };

    this.uniforms.push(uniform);
    this.hideUniformModal();
    this.renderUniformList();
    this.onShaderChanged();
  }

  deleteUniform(id) {
    this.uniforms = this.uniforms.filter((u) => u.id !== id);
    this.renderUniformList();
    this.onShaderChanged();
  }

  updateUniformValue(id, value) {
    const uniform = this.uniforms.find((u) => u.id === id);
    if (uniform) {
      uniform.value = value;
      this.onUniformValueChanged();
    }
  }

  setupCustomNodeModal() {
    this.customNodeModal = document.getElementById("customNodeModal");
    this.customNodeNameInput = document.getElementById("customNodeName");
    this.customNodeColorInput = document.getElementById("customNodeColor");
    this.customNodeInputsContainer =
      document.getElementById("customNodeInputs");
    this.customNodeOutputsContainer =
      document.getElementById("customNodeOutputs");
    this.customNodesList = document.getElementById("custom-nodes-list");

    // Code inputs
    this.customNodeWebGL1Dep = document.getElementById("customNodeWebGL1Dep");
    this.customNodeWebGL1Exec = document.getElementById("customNodeWebGL1Exec");
    this.customNodeWebGL2Dep = document.getElementById("customNodeWebGL2Dep");
    this.customNodeWebGL2Exec = document.getElementById("customNodeWebGL2Exec");
    this.customNodeWebGPUDep = document.getElementById("customNodeWebGPUDep");
    this.customNodeWebGPUExec = document.getElementById("customNodeWebGPUExec");

    // Buttons
    document.getElementById("addCustomInput").addEventListener("click", () => {
      this.addCustomPortItem(this.customNodeInputsContainer, "input");
    });

    document.getElementById("addCustomOutput").addEventListener("click", () => {
      this.addCustomPortItem(this.customNodeOutputsContainer, "output");
    });

    document.getElementById("saveCustomNode").addEventListener("click", () => {
      this.saveCustomNode();
    });

    document
      .getElementById("cancelCustomNode")
      .addEventListener("click", () => {
        this.hideCustomNodeModal();
      });

    // Close on background click
    this.customNodeModal.addEventListener("click", (e) => {
      if (e.target === this.customNodeModal) {
        this.hideCustomNodeModal();
      }
    });

    // Add custom node button in sidebar
    document
      .getElementById("addCustomNodeBtn")
      .addEventListener("click", () => {
        this.showCustomNodeModal();
      });
  }

  showCustomNodeModal(customNode = null) {
    this.editingCustomNode = customNode;

    // Clear form
    this.customNodeNameInput.value = "";
    this.customNodeColorInput.value = "#9b59b6";
    this.customNodeInputsContainer.innerHTML = "";
    this.customNodeOutputsContainer.innerHTML = "";
    this.customNodeWebGL1Dep.value = "";
    this.customNodeWebGL1Exec.value = "";
    this.customNodeWebGL2Dep.value = "";
    this.customNodeWebGL2Exec.value = "";
    this.customNodeWebGPUDep.value = "";
    this.customNodeWebGPUExec.value = "";

    // If editing, populate form
    if (customNode) {
      this.customNodeNameInput.value = customNode.name;
      this.customNodeColorInput.value = customNode.color || "#9b59b6";

      customNode.inputs.forEach((input) => {
        this.addCustomPortItem(
          this.customNodeInputsContainer,
          "input",
          input.name,
          input.type
        );
      });

      customNode.outputs.forEach((output) => {
        this.addCustomPortItem(
          this.customNodeOutputsContainer,
          "output",
          output.name,
          output.type
        );
      });

      this.customNodeWebGL1Dep.value = customNode.code.webgl1.dependency;
      this.customNodeWebGL1Exec.value = customNode.code.webgl1.execution;
      this.customNodeWebGL2Dep.value = customNode.code.webgl2.dependency;
      this.customNodeWebGL2Exec.value = customNode.code.webgl2.execution;
      this.customNodeWebGPUDep.value = customNode.code.webgpu.dependency;
      this.customNodeWebGPUExec.value = customNode.code.webgpu.execution;
    }

    this.customNodeModal.classList.add("visible");
  }

  hideCustomNodeModal() {
    this.customNodeModal.classList.remove("visible");
    this.editingCustomNode = null;
  }

  setupPreview() {
    this.previewIframe = document.getElementById("preview-iframe");
    const previewWindow = document.getElementById("preview-window");
    const previewHeader = document.getElementById("preview-header");
    const closePreviewBtn = document.getElementById("closePreviewBtn");
    this.shaderErrorsContainer = document.getElementById(
      "shader-errors-container"
    );
    this.shaderErrors = new Map(); // Track unique errors

    // Make preview window draggable
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const reloadPreviewBtn = document.getElementById("reloadPreviewBtn");

    previewHeader.addEventListener("mousedown", (e) => {
      if (e.target === closePreviewBtn || e.target === reloadPreviewBtn) return;
      isDragging = true;
      const rect = previewWindow.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        previewWindow.style.left = `${e.clientX - dragOffsetX}px`;
        previewWindow.style.top = `${e.clientY - dragOffsetY}px`;
        previewWindow.style.bottom = "auto";
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Reload button
    reloadPreviewBtn.addEventListener("click", () => {
      this.updatePreview();
    });

    // Close button
    closePreviewBtn.addEventListener("click", () => {
      previewWindow.style.display = "none";
    });

    // Listen for messages from preview iframe
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "projectReady") {
        this.previewReady = true;
        this.clearShaderErrors(); // Clear errors on new load
        this.sendUniformValuesToPreview();
      } else if (event.data && event.data.type === "shaderError") {
        this.displayShaderError(event.data.message, event.data.severity);
      }
    });

    // Initial preview update
    setTimeout(() => {
      this.updatePreview();
    }, 100);
  }

  updatePreview() {
    if (!this.previewIframe) return;

    // Clear previous errors
    this.clearShaderErrors();

    // Generate shader code
    const shaders = this.generateAllShaders();
    if (!shaders) {
      // Display error if shader generation failed
      this.displayShaderError(
        "Failed to generate shader. Make sure you have an Output node and all required connections are made.",
        "error"
      );
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.set("shader_glsl", encodeURIComponent(shaders.webgl1));
    params.set("shader_glslWebGL2", encodeURIComponent(shaders.webgl2));
    params.set("shader_wgsl", encodeURIComponent(shaders.webgpu));
    params.set("shader_blendsBackground", this.shaderSettings.blendsBackground);
    params.set("shader_crossSampling", this.shaderSettings.crossSampling);
    params.set(
      "shader_preservesOpaqueness",
      this.shaderSettings.preservesOpaqueness
    );
    params.set("shader_animated", this.shaderSettings.animated);
    params.set("shader_extendBoxHorizontal", this.shaderSettings.extendBoxH);
    params.set("shader_extendBoxVertical", this.shaderSettings.extendBoxV);

    // Generate parameters array
    const parameters = this.uniforms.map((uniform) => {
      let value = uniform.value;
      // Convert color values to array format [r, g, b]
      if (
        uniform.type === "color" &&
        typeof value === "object" &&
        value.r !== undefined
      ) {
        value = [value.r, value.g, value.b];
      }
      return [
        uniform.variableName,
        0,
        uniform.type === "color"
          ? "color"
          : uniform.isPercent
          ? "percent"
          : "float",
      ];
    });

    // Add parameters as JSON string
    if (parameters.length > 0) {
      params.set("shader_parameters", JSON.stringify(parameters));
    }

    // Reload iframe with new parameters
    this.previewReady = false;
    this.previewIframe.src = `preview/index.html?${params.toString()}`;
  }

  sendUniformValuesToPreview() {
    if (!this.previewReady || !this.previewIframe) return;

    this.uniforms.forEach((uniform, index) => {
      // Convert color values to array format [r, g, b]
      let value = uniform.value;
      if (
        uniform.type === "color" &&
        typeof value === "object" &&
        value.r !== undefined
      ) {
        value = [value.r, value.g, value.b];
      }

      this.previewIframe.contentWindow.postMessage(
        {
          type: "updateParam",
          index: index,
          value: value,
        },
        "*"
      );
    });
  }

  generateAllShaders() {
    try {
      // Build dependency graph
      const graph = this.buildDependencyGraph();

      if (!graph) {
        console.warn("No output node found. Cannot generate shader.");
        return null;
      }

      const levels = this.topologicalSort(
        graph.dependencies,
        graph.connectedNodes
      );

      // Generate shaders for all targets (each needs its own variable names for proper value formatting)
      const webgl1PortToVarName = this.generateVariableNames(levels, "webgl1");
      const webgl1Boilerplate = this.getBoilerplate("webgl1");
      const webgl1Uniforms = this.generateUniformDeclarations("webgl1");
      const webgl1Code = this.generateShader(
        "webgl1",
        levels,
        webgl1PortToVarName
      );
      const webgl1 = webgl1Boilerplate + webgl1Uniforms + webgl1Code;

      const webgl2PortToVarName = this.generateVariableNames(levels, "webgl2");
      const webgl2Boilerplate = this.getBoilerplate("webgl2");
      const webgl2Uniforms = this.generateUniformDeclarations("webgl2");
      const webgl2Code = this.generateShader(
        "webgl2",
        levels,
        webgl2PortToVarName
      );
      const webgl2 = webgl2Boilerplate + webgl2Uniforms + webgl2Code;

      const webgpuPortToVarName = this.generateVariableNames(levels, "webgpu");
      const webgpuBoilerplate = this.getBoilerplate("webgpu");
      const webgpuUniforms = this.generateUniformDeclarations("webgpu");
      const webgpuCode = this.generateShader(
        "webgpu",
        levels,
        webgpuPortToVarName
      );
      const webgpu = webgpuBoilerplate + webgpuUniforms + webgpuCode;

      return { webgl1, webgl2, webgpu };
    } catch (error) {
      console.error("Error generating shaders:", error);
      return null;
    }
  }

  onShaderChanged() {
    // Called whenever the shader structure changes (not just uniform values)
    this.updatePreview();
  }

  onUniformValueChanged() {
    // Called whenever a uniform value changes
    this.sendUniformValuesToPreview();
  }

  displayShaderError(message, severity) {
    // Use message as key to avoid duplicates
    const errorKey = `${severity}:${message}`;

    // Don't add duplicate errors
    if (this.shaderErrors.has(errorKey)) {
      return;
    }

    const errorItem = document.createElement("div");
    errorItem.className = `shader-error-item ${severity}`;

    const icon = document.createElement("div");
    icon.className = "shader-error-icon";
    icon.textContent = severity === "error" ? "⚠" : "⚠";

    const messageDiv = document.createElement("div");
    messageDiv.className = "shader-error-message";
    messageDiv.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "shader-error-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
      errorItem.remove();
      this.shaderErrors.delete(errorKey);
    });

    errorItem.appendChild(icon);
    errorItem.appendChild(messageDiv);
    errorItem.appendChild(closeBtn);

    this.shaderErrorsContainer.appendChild(errorItem);
    this.shaderErrors.set(errorKey, errorItem);
  }

  clearShaderErrors() {
    this.shaderErrorsContainer.innerHTML = "";
    this.shaderErrors.clear();
  }

  addCustomPortItem(container, portType, name = "", type = "float") {
    const item = document.createElement("div");
    item.className = "custom-port-item";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = `${portType === "input" ? "Input" : "Output"} name`;
    nameInput.value = name;

    const typeSelect = document.createElement("select");
    const types = [
      "float",
      "int",
      "boolean",
      "vec2",
      "vec3",
      "vec4",
      "color",
      "texture",
    ];
    types.forEach((t) => {
      const option = document.createElement("option");
      option.value = t;
      option.textContent = t;
      if (t === type) option.selected = true;
      typeSelect.appendChild(option);
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      item.remove();
    });

    item.appendChild(nameInput);
    item.appendChild(typeSelect);
    item.appendChild(removeBtn);
    container.appendChild(item);
  }

  saveCustomNode() {
    const name = this.customNodeNameInput.value.trim();
    if (!name) {
      alert("Please enter a node name");
      return;
    }

    // Collect inputs
    const inputs = [];
    this.customNodeInputsContainer
      .querySelectorAll(".custom-port-item")
      .forEach((item) => {
        const nameInput = item.querySelector("input");
        const typeSelect = item.querySelector("select");
        if (nameInput.value.trim()) {
          inputs.push({
            name: nameInput.value.trim(),
            type: typeSelect.value,
          });
        }
      });

    // Collect outputs
    const outputs = [];
    this.customNodeOutputsContainer
      .querySelectorAll(".custom-port-item")
      .forEach((item) => {
        const nameInput = item.querySelector("input");
        const typeSelect = item.querySelector("select");
        if (nameInput.value.trim()) {
          outputs.push({
            name: nameInput.value.trim(),
            type: typeSelect.value,
          });
        }
      });

    if (outputs.length === 0) {
      alert("Please add at least one output");
      return;
    }

    // Create custom node definition
    const customNode = {
      id: this.editingCustomNode
        ? this.editingCustomNode.id
        : this.customNodeIdCounter++,
      name: name,
      color: this.customNodeColorInput.value,
      inputs: inputs,
      outputs: outputs,
      code: {
        webgl1: {
          dependency: this.customNodeWebGL1Dep.value,
          execution: this.customNodeWebGL1Exec.value,
        },
        webgl2: {
          dependency: this.customNodeWebGL2Dep.value,
          execution: this.customNodeWebGL2Exec.value,
        },
        webgpu: {
          dependency: this.customNodeWebGPUDep.value,
          execution: this.customNodeWebGPUExec.value,
        },
      },
    };

    if (this.editingCustomNode) {
      // Update existing
      const index = this.customNodes.findIndex(
        (n) => n.id === this.editingCustomNode.id
      );
      if (index !== -1) {
        this.customNodes[index] = customNode;
        // Update all nodes in the graph that use this custom node
        this.updateCustomNodeInstances(customNode);
      }
    } else {
      // Add new
      this.customNodes.push(customNode);
    }

    this.renderCustomNodesList();
    this.hideCustomNodeModal();
    console.log("Custom node saved:", customNode);
  }

  updateCustomNodeInstances(customNode) {
    // Find all nodes in the graph that use this custom node
    const customNodeKey = `custom_${customNode.id}`;
    const affectedNodes = this.nodes.filter((node) => {
      const nodeTypeKey = this.getNodeTypeKey(node.nodeType);
      return nodeTypeKey === customNodeKey;
    });

    affectedNodes.forEach((node) => {
      // Store old port counts
      const oldInputCount = node.inputPorts.length;
      const oldOutputCount = node.outputPorts.length;

      // Update the node type
      node.nodeType = this.createNodeTypeFromCustomNode(customNode);
      node.title = customNode.name;
      node.headerColor = customNode.color;

      // Recreate ports
      const oldInputPorts = [...node.inputPorts];
      const oldOutputPorts = [...node.outputPorts];

      node.inputPorts = customNode.inputs.map((input, index) => {
        const oldPort = oldInputPorts[index];
        const port = new Port(node, input.name, input.type, "input", index);
        // Preserve value if port still exists and type matches
        if (oldPort && oldPort.portType === input.type) {
          port.value = oldPort.value;
          // Preserve connections if type matches
          port.connections = oldPort.connections.filter((wire) => {
            const outputType = wire.startPort.portType;
            if (areTypesCompatible(outputType, input.type)) {
              wire.endPort = port;
              return true;
            } else {
              // Disconnect incompatible wire
              this.disconnectWire(wire);
              return false;
            }
          });
        }
        return port;
      });

      node.outputPorts = customNode.outputs.map((output, index) => {
        const oldPort = oldOutputPorts[index];
        const port = new Port(node, output.name, output.type, "output", index);
        // Preserve connections if port still exists and type matches
        if (oldPort && oldPort.portType === output.type) {
          port.connections = oldPort.connections.filter((wire) => {
            const inputType = wire.endPort.portType;
            if (areTypesCompatible(output.type, inputType)) {
              wire.startPort = port;
              return true;
            } else {
              // Disconnect incompatible wire
              this.disconnectWire(wire);
              return false;
            }
          });
        }
        return port;
      });

      // Disconnect wires from removed ports
      for (let i = customNode.inputs.length; i < oldInputCount; i++) {
        const oldPort = oldInputPorts[i];
        if (oldPort) {
          [...oldPort.connections].forEach((wire) => this.disconnectWire(wire));
        }
      }

      for (let i = customNode.outputs.length; i < oldOutputCount; i++) {
        const oldPort = oldOutputPorts[i];
        if (oldPort) {
          [...oldPort.connections].forEach((wire) => this.disconnectWire(wire));
        }
      }

      // Recalculate node height
      const maxPorts = Math.max(
        node.inputPorts.length,
        node.outputPorts.length
      );
      node.height = 50 + maxPorts * 40 + 10;
    });

    this.render();
    this.updateDependencyList();
  }

  renderCustomNodesList() {
    this.customNodesList.innerHTML = "";

    this.customNodes.forEach((customNode) => {
      const item = document.createElement("div");
      item.className = "uniform-item";
      item.style.borderLeft = `4px solid ${customNode.color}`;

      const header = document.createElement("div");
      header.className = "uniform-item-header";
      header.style.paddingLeft = "24px"; // Make room for drag handle

      // Drag handle (the colored bar area)
      const dragHandle = document.createElement("div");
      dragHandle.className = "custom-node-drag-handle";
      dragHandle.style.position = "absolute";
      dragHandle.style.left = "0";
      dragHandle.style.top = "0";
      dragHandle.style.bottom = "0";
      dragHandle.style.width = "20px";
      dragHandle.style.background = customNode.color;
      dragHandle.style.cursor = "grab";
      dragHandle.style.display = "flex";
      dragHandle.style.alignItems = "center";
      dragHandle.style.justifyContent = "center";
      dragHandle.style.color = "rgba(255, 255, 255, 0.6)";
      dragHandle.style.fontSize = "14px";
      dragHandle.style.userSelect = "none";
      dragHandle.textContent = "⋮⋮";
      dragHandle.title = "Drag to canvas to create node";

      // Make item draggable from handle
      let isDraggingFromHandle = false;

      dragHandle.addEventListener("mousedown", (e) => {
        isDraggingFromHandle = true;
        item.draggable = true;
        dragHandle.style.cursor = "grabbing";
      });

      item.addEventListener("dragstart", (e) => {
        if (isDraggingFromHandle) {
          e.dataTransfer.setData("customNodeId", customNode.id.toString());
          e.dataTransfer.effectAllowed = "copy";
        } else {
          e.preventDefault();
        }
      });

      item.addEventListener("dragend", (e) => {
        item.draggable = false;
        isDraggingFromHandle = false;
        dragHandle.style.cursor = "grab";
      });

      const nameSpan = document.createElement("span");
      nameSpan.textContent = customNode.name;
      nameSpan.style.fontWeight = "bold";
      nameSpan.style.color = "#4a90e2";
      nameSpan.style.flex = "1";

      const infoSpan = document.createElement("span");
      infoSpan.textContent = `${customNode.inputs.length}→${customNode.outputs.length}`;
      infoSpan.style.fontSize = "11px";
      infoSpan.style.color = "#888";
      infoSpan.style.marginLeft = "8px";

      const controls = document.createElement("div");
      controls.className = "uniform-item-controls";

      const editBtn = document.createElement("button");
      editBtn.className = "uniform-delete-btn";
      editBtn.textContent = "✎";
      editBtn.title = "Edit";
      editBtn.style.background = "#4a90e2";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showCustomNodeModal(customNode);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "uniform-delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.title = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteCustomNode(customNode.id);
      });

      controls.appendChild(editBtn);
      controls.appendChild(deleteBtn);

      item.appendChild(dragHandle);
      header.appendChild(nameSpan);
      header.appendChild(infoSpan);
      header.appendChild(controls);
      item.appendChild(header);

      this.customNodesList.appendChild(item);
    });
  }

  deleteCustomNode(id) {
    // Check if any nodes in the graph use this custom node
    const customNodeKey = `custom_${id}`;
    const hasInstances = this.nodes.some((node) => {
      const nodeTypeKey = this.getNodeTypeKey(node.nodeType);
      return nodeTypeKey === customNodeKey;
    });

    if (hasInstances) {
      if (
        !confirm(
          "This custom node is being used in the graph. Delete anyway? All instances will be removed."
        )
      ) {
        return;
      }
      // Remove all instances
      this.nodes = this.nodes.filter((node) => {
        const nodeTypeKey = this.getNodeTypeKey(node.nodeType);
        if (nodeTypeKey === customNodeKey) {
          // Disconnect all wires
          node.getAllPorts().forEach((port) => {
            [...port.connections].forEach((wire) => this.disconnectWire(wire));
          });
          return false;
        }
        return true;
      });
      this.render();
      this.updateDependencyList();
    }

    this.customNodes = this.customNodes.filter((n) => n.id !== id);
    this.renderCustomNodesList();
  }

  renderUniformList() {
    this.uniformList.innerHTML = "";

    this.uniforms.forEach((uniform, index) => {
      const item = document.createElement("div");
      item.className = "uniform-item";
      item.dataset.uniformId = uniform.id;
      item.dataset.uniformIndex = index;

      // Item is not draggable by default
      item.draggable = false;

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        const draggingItem = this.uniformList.querySelector(".dragging");
        if (draggingItem && draggingItem !== item) {
          const rect = item.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (e.clientY < midpoint) {
            item.parentNode.insertBefore(draggingItem, item);
          } else {
            item.parentNode.insertBefore(draggingItem, item.nextSibling);
          }
        }
      });

      item.addEventListener("drop", (e) => {
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("uniformId");
        if (draggedId) {
          // Reorder the uniforms array based on DOM order
          const newOrder = [];
          Array.from(this.uniformList.children).forEach((child) => {
            const id = parseInt(child.dataset.uniformId);
            const uniform = this.uniforms.find((u) => u.id === id);
            if (uniform) newOrder.push(uniform);
          });
          this.uniforms = newOrder;
        }
      });

      const header = document.createElement("div");
      header.className = "uniform-item-header";

      // Drag handle
      const dragHandle = document.createElement("div");
      dragHandle.className = "uniform-drag-handle";
      dragHandle.innerHTML = "⋮⋮";
      dragHandle.title = "Drag to reorder or create node";

      // Track if drag started from handle
      let dragFromHandle = false;

      // Make handle draggable
      dragHandle.addEventListener("mousedown", (e) => {
        dragFromHandle = true;
        item.draggable = true;
      });

      // Drag events for the item
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("uniformId", uniform.id.toString());
        e.dataTransfer.effectAllowed = "copyMove";
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", (e) => {
        item.classList.remove("dragging");
        item.draggable = false;
        dragFromHandle = false;
      });

      // Name and info container
      const nameContainer = document.createElement("div");
      nameContainer.className = "uniform-name-container";

      // Editable name input
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "uniform-item-name-input";
      nameInput.value = uniform.name;
      nameInput.addEventListener("change", (e) => {
        const newName = e.target.value.trim();
        if (newName && newName !== uniform.name) {
          const oldName = uniform.name;
          const oldVariableName = uniform.variableName;
          uniform.name = newName;

          // Regenerate variable name
          let newVariableName = this.sanitizeVariableName(newName);
          let counter = 1;
          const baseVariableName = newVariableName;
          while (
            this.uniforms.some(
              (u) => u.id !== uniform.id && u.variableName === newVariableName
            ) ||
            this.uniforms.some(
              (u) => u.id !== uniform.id && u.name === newVariableName
            )
          ) {
            newVariableName = `${baseVariableName}_${counter}`;
            counter++;
          }
          uniform.variableName = newVariableName;

          this.updateUniformNodeNames(oldVariableName, newVariableName);
          this.renderUniformList(); // Re-render to show new variable name
        }
      });
      nameInput.addEventListener("click", (e) => e.stopPropagation());

      // Info line (variable name + type)
      const infoLine = document.createElement("div");
      infoLine.className = "uniform-info-line";

      // Show variable name if different from display name
      if (uniform.variableName !== uniform.name) {
        const variableNameHint = document.createElement("small");
        variableNameHint.className = "uniform-variable-name";
        variableNameHint.textContent = `${uniform.variableName}`;
        variableNameHint.title = "Variable name used in shader code";
        infoLine.appendChild(variableNameHint);

        const separator = document.createElement("span");
        separator.textContent = " • ";
        separator.style.color = "#666";
        infoLine.appendChild(separator);
      }

      const typeSpan = document.createElement("span");
      typeSpan.className = "uniform-item-type-inline";
      typeSpan.textContent = uniform.type === "color" ? "Color" : "Float";
      infoLine.appendChild(typeSpan);

      // Description (editable)
      const descSeparator = document.createElement("span");
      descSeparator.textContent = " • ";
      descSeparator.style.color = "#666";
      infoLine.appendChild(descSeparator);

      const descInput = document.createElement("input");
      descInput.type = "text";
      descInput.className = "uniform-description-input";
      descInput.value = uniform.description ?? "";
      descInput.placeholder = "Add description...";
      descInput.addEventListener("change", (e) => {
        uniform.description = e.target.value.trim();
      });
      descInput.addEventListener("click", (e) => e.stopPropagation());
      descInput.addEventListener("mousedown", (e) => e.stopPropagation());
      infoLine.appendChild(descInput);

      nameContainer.appendChild(nameInput);
      nameContainer.appendChild(infoLine);

      const controls = document.createElement("div");
      controls.className = "uniform-item-controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "uniform-delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.title = "Delete";
      deleteBtn.addEventListener("click", () => this.deleteUniform(uniform.id));

      controls.appendChild(deleteBtn);
      header.appendChild(dragHandle);
      header.appendChild(nameContainer);
      header.appendChild(controls);

      item.appendChild(header);

      // Value control
      const valueControl = document.createElement("div");
      valueControl.className = "uniform-value-control";

      if (uniform.type === "float") {
        const floatContainer = document.createElement("div");
        floatContainer.className = "uniform-float-compact";

        // Number input and percent checkbox on same line
        const inputRow = document.createElement("div");
        inputRow.className = "uniform-input-row";

        const numberInput = document.createElement("input");
        numberInput.type = "number";
        numberInput.step = "0.01";
        numberInput.value = uniform.value;
        numberInput.className = "uniform-number-input-compact";

        numberInput.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value) || 0;
          this.updateUniformValue(uniform.id, val);
          if (uniform.isPercent && slider) {
            slider.value = Math.min(1, Math.max(0, val));
            percentText.textContent = `${Math.round(val * 100)}%`;
          }
        });

        numberInput.addEventListener("mousedown", (e) => e.stopPropagation());
        numberInput.addEventListener("click", (e) => e.stopPropagation());

        // Is Percent checkbox (compact)
        const percentCheckbox = document.createElement("label");
        percentCheckbox.className = "checkbox-label-compact";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = uniform.isPercent || false;

        const checkboxLabel = document.createElement("span");
        checkboxLabel.textContent = "%";
        checkboxLabel.title = "Is Percent";

        checkbox.addEventListener("change", (e) => {
          uniform.isPercent = checkbox.checked;
          // Toggle slider visibility
          if (uniform.isPercent) {
            percentSliderContainer.style.display = "flex";
          } else {
            percentSliderContainer.style.display = "none";
          }
        });

        percentCheckbox.appendChild(checkbox);
        percentCheckbox.appendChild(checkboxLabel);

        inputRow.appendChild(numberInput);
        inputRow.appendChild(percentCheckbox);
        floatContainer.appendChild(inputRow);

        // Percent slider (shown only if isPercent is true)
        const percentSliderContainer = document.createElement("div");
        percentSliderContainer.className = "uniform-percent-display-compact";
        percentSliderContainer.style.display = uniform.isPercent
          ? "flex"
          : "none";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = Math.min(1, Math.max(0, uniform.value));

        const percentText = document.createElement("span");
        percentText.textContent = `${Math.round(uniform.value * 100)}%`;
        percentText.className = "percent-text-compact";

        slider.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value);
          this.updateUniformValue(uniform.id, val);
          numberInput.value = val.toFixed(2);
          percentText.textContent = `${Math.round(val * 100)}%`;
        });

        slider.addEventListener("mousedown", (e) => e.stopPropagation());
        slider.addEventListener("pointerdown", (e) => e.stopPropagation());

        percentSliderContainer.appendChild(slider);
        percentSliderContainer.appendChild(percentText);
        floatContainer.appendChild(percentSliderContainer);

        valueControl.appendChild(floatContainer);
      } else if (uniform.type === "color") {
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        const rgbToHex = (r, g, b) => {
          const toHex = (n) =>
            Math.round(n * 255)
              .toString(16)
              .padStart(2, "0");
          return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };
        colorInput.value = rgbToHex(
          uniform.value.r,
          uniform.value.g,
          uniform.value.b
        );

        colorInput.addEventListener("input", (e) => {
          const hex = e.target.value;
          const r = parseInt(hex.substr(1, 2), 16) / 255;
          const g = parseInt(hex.substr(3, 2), 16) / 255;
          const b = parseInt(hex.substr(5, 2), 16) / 255;
          this.updateUniformValue(uniform.id, { r, g, b });
        });

        colorInput.addEventListener("mousedown", (e) => e.stopPropagation());
        colorInput.addEventListener("click", (e) => e.stopPropagation());

        valueControl.appendChild(colorInput);
      }

      item.appendChild(valueControl);
      this.uniformList.appendChild(item);
    });
  }

  createUniformNode(uniform, x, y) {
    // Determine node type based on uniform type
    let nodeType;
    if (uniform.type === "color") {
      nodeType = UniformColorNode;
    } else {
      // Float type uses UniformFloatNode
      nodeType = UniformFloatNode;
    }

    // Use provided position or center of viewport
    const posX =
      x !== undefined
        ? x
        : (-this.camera.x + this.canvas.width / 2) / this.camera.zoom;
    const posY =
      y !== undefined
        ? y
        : (-this.camera.y + this.canvas.height / 2) / this.camera.zoom;

    const node = new Node(posX, posY, this.nodeIdCounter++, nodeType);
    node.uniformName = uniform.variableName; // Use variable name for shader code
    node.uniformDisplayName = uniform.name; // Store display name
    node.uniformVariableName = uniform.variableName; // Store variable name
    node.uniformId = uniform.id;
    node.isVariable = true; // Make it look like a variable node

    // Update node title to show display name
    node.title = uniform.name;
    node.nodeType = {
      ...nodeType,
      name: uniform.name, // Display name for the node
      isUniform: true,
      uniformId: uniform.id,
    };

    this.nodes.push(node);
    this.render();
    this.onShaderChanged();
    return node;
  }

  updateUniformNodeNames(oldVariableName, newVariableName) {
    // Update all nodes that reference this uniform
    // Find the uniform to get both names
    const uniform = this.uniforms.find(
      (u) => u.variableName === newVariableName
    );
    if (!uniform) return;

    this.nodes.forEach((node) => {
      if (node.uniformName === oldVariableName) {
        node.uniformName = newVariableName;
        node.uniformDisplayName = uniform.name;
        node.uniformVariableName = newVariableName;
        node.title = uniform.name;
        node.nodeType = {
          ...node.nodeType,
          name: uniform.name,
        };
      }
    });
    this.render();
  }

  getUniformNodeTypes() {
    // Return uniform nodes for search menu
    const uniformNodeTypes = {};
    this.uniforms.forEach((uniform) => {
      const nodeType =
        uniform.type === "color" ? UniformColorNode : UniformFloatNode;
      uniformNodeTypes[`uniform_${uniform.id}`] = {
        ...nodeType,
        name: uniform.name,
        isUniform: true,
        uniformId: uniform.id,
        uniformName: uniform.name,
      };
    });
    return uniformNodeTypes;
  }

  startEditingPort(port) {
    if (!port.isEditable || port.connections.length > 0) return;

    const resolvedType = port.getResolvedType();

    // For boolean types, just toggle the value directly
    if (resolvedType === "boolean") {
      port.value = !port.value;
      this.render();
      this.onShaderChanged();
      return;
    }

    this.editingPort = port;
    const bounds = port.getValueBoxBounds(this.ctx);
    const rect = this.canvas.getBoundingClientRect();

    // Transform world coordinates to screen coordinates
    const screenX = bounds.x * this.camera.zoom + this.camera.x;
    const screenY = bounds.y * this.camera.zoom + this.camera.y;
    const screenWidth = bounds.width * this.camera.zoom;
    const screenHeight = bounds.height * this.camera.zoom;

    // Handle different editor types based on resolved type
    if (resolvedType === "vec2") {
      this.vec2Editor.style.left = `${rect.left + window.scrollX + screenX}px`;
      this.vec2Editor.style.top = `${rect.top + window.scrollY + screenY}px`;
      this.vec2Editor.style.display = "flex";
      this.vec2Editor.style.transform = `scale(${this.camera.zoom})`;
      this.vec2Editor.style.transformOrigin = "top left";

      const vec2X = document.getElementById("vec2X");
      const vec2Y = document.getElementById("vec2Y");
      vec2X.value = port.value[0];
      vec2Y.value = port.value[1];

      setTimeout(() => vec2X.focus(), 0);
    } else if (resolvedType === "vec3") {
      this.vec3Editor.style.left = `${rect.left + window.scrollX + screenX}px`;
      this.vec3Editor.style.top = `${rect.top + window.scrollY + screenY}px`;
      this.vec3Editor.style.display = "flex";
      this.vec3Editor.style.transform = `scale(${this.camera.zoom})`;
      this.vec3Editor.style.transformOrigin = "top left";

      const vec3Color = document.getElementById("vec3Color");
      const vec3R = document.getElementById("vec3R");
      const vec3G = document.getElementById("vec3G");
      const vec3B = document.getElementById("vec3B");

      const r = Math.round(port.value[0] * 255);
      const g = Math.round(port.value[1] * 255);
      const b = Math.round(port.value[2] * 255);
      vec3Color.value = `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      vec3R.value = port.value[0].toFixed(2);
      vec3G.value = port.value[1].toFixed(2);
      vec3B.value = port.value[2].toFixed(2);

      setTimeout(() => vec3R.focus(), 0);
    } else if (resolvedType === "vec4") {
      this.vec4Editor.style.left = `${rect.left + window.scrollX + screenX}px`;
      this.vec4Editor.style.top = `${rect.top + window.scrollY + screenY}px`;
      this.vec4Editor.style.display = "flex";
      this.vec4Editor.style.transform = `scale(${this.camera.zoom})`;
      this.vec4Editor.style.transformOrigin = "top left";

      const vec4Color = document.getElementById("vec4Color");
      const vec4R = document.getElementById("vec4R");
      const vec4G = document.getElementById("vec4G");
      const vec4B = document.getElementById("vec4B");
      const vec4A = document.getElementById("vec4A");

      const r = Math.round(port.value[0] * 255);
      const g = Math.round(port.value[1] * 255);
      const b = Math.round(port.value[2] * 255);
      vec4Color.value = `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      vec4R.value = port.value[0].toFixed(2);
      vec4G.value = port.value[1].toFixed(2);
      vec4B.value = port.value[2].toFixed(2);
      vec4A.value = port.value[3].toFixed(2);

      setTimeout(() => vec4R.focus(), 0);
    } else {
      // Default text input for float, int
      this.inputField.value = port.value.toString();
      this.inputField.style.left = `${rect.left + window.scrollX + screenX}px`;
      this.inputField.style.top = `${rect.top + window.scrollY + screenY}px`;
      this.inputField.style.width = `${screenWidth}px`;
      this.inputField.style.height = `${screenHeight}px`;
      this.inputField.style.display = "block";
      this.inputField.style.visibility = "visible";
      this.inputField.style.opacity = "1";
      this.inputField.style.pointerEvents = "auto";
      this.inputField.style.transform = `scale(${this.camera.zoom})`;
      this.inputField.style.transformOrigin = "top left";

      setTimeout(() => {
        this.inputField.focus();
        this.inputField.select();
      }, 0);
    }
  }

  finishEditingPort() {
    if (!this.editingPort) return;

    const resolvedType = this.editingPort.getResolvedType();

    if (resolvedType === "vec2") {
      const vec2X = document.getElementById("vec2X");
      const vec2Y = document.getElementById("vec2Y");
      const x = parseFloat(vec2X.value);
      const y = parseFloat(vec2Y.value);
      if (!isNaN(x) && !isNaN(y)) {
        this.editingPort.value = [x, y];
      }
    } else if (resolvedType === "vec3") {
      const vec3R = document.getElementById("vec3R");
      const vec3G = document.getElementById("vec3G");
      const vec3B = document.getElementById("vec3B");
      const r = parseFloat(vec3R.value);
      const g = parseFloat(vec3G.value);
      const b = parseFloat(vec3B.value);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        this.editingPort.value = [r, g, b];
      }
    } else if (resolvedType === "vec4") {
      const vec4R = document.getElementById("vec4R");
      const vec4G = document.getElementById("vec4G");
      const vec4B = document.getElementById("vec4B");
      const vec4A = document.getElementById("vec4A");
      const r = parseFloat(vec4R.value);
      const g = parseFloat(vec4G.value);
      const b = parseFloat(vec4B.value);
      const a = parseFloat(vec4A.value);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b) && !isNaN(a)) {
        this.editingPort.value = [r, g, b, a];
      }
    } else {
      const value = this.inputField.value;
      if (resolvedType === "int") {
        const intValue = parseInt(value);
        if (!isNaN(intValue)) {
          this.editingPort.value = intValue;
        }
      } else if (resolvedType === "float") {
        const floatValue = parseFloat(value);
        if (!isNaN(floatValue)) {
          this.editingPort.value = floatValue;
        }
      }
    }

    // Recalculate node height in case vec3/vec4 values changed from in-range to out-of-range or vice versa
    if (this.editingPort) {
      this.editingPort.node.recalculateHeight();
    }

    this.hideInputField();
    this.render();
    this.onShaderChanged();
  }

  cancelEditingPort() {
    this.hideInputField();
  }

  hideInputField() {
    this.inputField.style.display = "none";
    this.inputField.style.visibility = "hidden";
    this.inputField.style.opacity = "0";
    this.inputField.style.pointerEvents = "none";
    this.vec2Editor.style.display = "none";
    this.vec3Editor.style.display = "none";
    this.vec4Editor.style.display = "none";
    this.editingPort = null;
  }

  startEditingCustomInput(node) {
    this.editingCustomInput = node;
    const bounds = node.getCustomInputBounds();
    const config = node.nodeType.customInputConfig;

    // Position the input field
    const rect = this.canvas.getBoundingClientRect();
    this.customInputField.style.left = `${rect.left + bounds.x}px`;
    this.customInputField.style.top = `${rect.top + bounds.y}px`;
    this.customInputField.style.width = `${bounds.width}px`;
    this.customInputField.style.height = `${bounds.height}px`;
    this.customInputField.style.display = "block";

    // Set current value
    this.customInputField.value = node.customInput || config.defaultValue;
    this.customInputField.placeholder = config.placeholder || "";

    // Focus and select
    setTimeout(() => {
      this.customInputField.focus();
      this.customInputField.select();
    }, 0);

    this.render();
  }

  finishEditingCustomInput() {
    if (!this.editingCustomInput) return;

    const node = this.editingCustomInput;
    const newValue = this.customInputField.value;
    const config = node.nodeType.customInputConfig;

    // Validate the input
    if (config.validate) {
      const validation = config.validate(newValue, node);
      if (!validation.valid) {
        // Show error and revert to previous value
        alert(validation.error);
        // Revert to the previous valid value
        this.customInputField.value = node.customInput || config.defaultValue;
        this.customInputField.focus();
        this.customInputField.select();
        return;
      }
    }

    // Update the value and handle type changes
    node.updateCustomInput(newValue, this);

    // Hide the input field
    this.customInputField.style.display = "none";
    this.editingCustomInput = null;

    // Recalculate node height if needed
    node.recalculateHeight();

    this.render();
    this.onShaderChanged();
  }

  cancelEditingCustomInput() {
    this.customInputField.style.display = "none";
    this.editingCustomInput = null;
    this.render();
  }

  showSearchMenu(x, y, filterPort = null, filterType = null) {
    this.searchMenuPosition = { x, y };
    this.searchFilterPort = filterPort;
    this.searchFilterType = filterType;

    // Position the menu
    this.searchMenu.style.left = `${x}px`;
    this.searchMenu.style.top = `${y}px`;

    // Clear and show
    this.searchInput.value = "";
    this.searchMenu.classList.add("visible");
    this.updateSearchResults();

    // Focus the input
    setTimeout(() => {
      this.searchInput.focus();
    }, 0);
  }

  hideSearchMenu() {
    this.searchMenu.classList.remove("visible");
    this.searchFilterPort = null;
    this.searchFilterType = null;
    this.searchInput.value = "";

    // If we were dragging a wire, cancel it
    if (this.activeWire) {
      this.activeWire = null;
      this.render();
    }
  }

  showOperationMenu(node, dropdownBounds) {
    // Create a temporary menu for operation selection
    const menu = document.createElement("div");
    menu.className = "operation-menu";
    menu.style.position = "fixed";

    // Convert world coordinates to screen coordinates
    const rect = this.canvas.getBoundingClientRect();
    const screenX =
      dropdownBounds.x * this.camera.zoom + this.camera.x + rect.left;
    const screenY =
      (dropdownBounds.y + dropdownBounds.height) * this.camera.zoom +
      this.camera.y +
      rect.top;
    const menuWidth = dropdownBounds.width * this.camera.zoom;

    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    menu.style.width = `${menuWidth}px`;
    menu.style.background = "#2a2a2a";
    menu.style.border = "2px solid #4a4a4a";
    menu.style.borderRadius = "4px";
    menu.style.padding = "2px";
    menu.style.zIndex = "10000";
    menu.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.5)";

    node.nodeType.operationOptions.forEach((op) => {
      const option = document.createElement("div");
      option.textContent = op.label;
      option.style.padding = "6px 8px";
      option.style.cursor = "pointer";
      option.style.color = "#fff";
      option.style.fontSize = "14px";
      option.style.borderRadius = "3px";
      option.style.textAlign = "center";
      option.style.userSelect = "none";

      if (node.operation === op.value) {
        option.style.background = "#4a90e2";
      }

      option.addEventListener("mouseenter", () => {
        if (node.operation !== op.value) {
          option.style.background = "#3a3a3a";
        }
      });

      option.addEventListener("mouseleave", () => {
        if (node.operation !== op.value) {
          option.style.background = "transparent";
        }
      });

      option.addEventListener("click", () => {
        node.operation = op.value;
        document.body.removeChild(menu);
        this.render();
        this.onShaderChanged();
      });

      menu.appendChild(option);
    });

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener("mousedown", closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", closeMenu);
    }, 0);

    document.body.appendChild(menu);
  }

  getFilteredNodeTypes() {
    let nodeTypes = Object.entries(NODE_TYPES);

    // Add uniform nodes
    const uniformNodeTypes = this.getUniformNodeTypes();
    nodeTypes = [...nodeTypes, ...Object.entries(uniformNodeTypes)];

    // Add custom nodes
    const customNodeTypes = this.getCustomNodeTypes();
    nodeTypes = [...nodeTypes, ...Object.entries(customNodeTypes)];

    // Filter out output node if one already exists
    const hasOutputNode = this.nodes.some(
      (node) => node.nodeType === NODE_TYPES.output
    );
    if (hasOutputNode) {
      nodeTypes = nodeTypes.filter(
        ([key, nodeType]) => nodeType !== NODE_TYPES.output
      );
    }

    // If we're filtering by port type
    if (this.searchFilterPort && this.searchFilterType) {
      // Use resolved type if the port is generic
      const portType = this.searchFilterPort.getResolvedType();

      nodeTypes = nodeTypes.filter(([key, nodeType]) => {
        if (this.searchFilterType === "input") {
          // Dragging from an input port - show nodes with compatible output ports
          return nodeType.outputs.some((output) =>
            areTypesCompatible(output.type, portType)
          );
        } else {
          // Dragging from an output port - show nodes with compatible input ports
          return nodeType.inputs.some((input) =>
            areTypesCompatible(portType, input.type)
          );
        }
      });
    }

    return nodeTypes;
  }

  getCustomNodeTypes() {
    const customNodeTypes = {};
    this.customNodes.forEach((customNode) => {
      const key = `custom_${customNode.id}`;
      customNodeTypes[key] = this.createNodeTypeFromCustomNode(customNode);
    });
    return customNodeTypes;
  }

  createNodeTypeFromCustomNode(customNode) {
    return {
      name: customNode.name,
      inputs: customNode.inputs,
      outputs: customNode.outputs,
      color: customNode.color || "#9b59b6",
      isCustom: true,
      customNodeId: customNode.id,
      getDependency: (target) => {
        return customNode.code[target]?.dependency || "";
      },
      getExecution: (target) => {
        return (inputs, outputs) => {
          let code = customNode.code[target]?.execution || "";
          // Replace placeholders
          inputs.forEach((input, i) => {
            code = code.replace(new RegExp(`\\{input${i}\\}`, "g"), input);
          });
          outputs.forEach((output, i) => {
            code = code.replace(new RegExp(`\\{output${i}\\}`, "g"), output);
          });
          return code;
        };
      },
    };
  }

  updateSearchResults() {
    const query = this.searchInput.value.toLowerCase();
    const filteredTypes = this.getFilteredNodeTypes();

    // Filter by search query (check name and tags)
    const results = filteredTypes.filter(([key, nodeType]) => {
      const nameMatch = nodeType.name.toLowerCase().includes(query);
      const tagMatch =
        nodeType.tags &&
        nodeType.tags.some((tag) => tag.toLowerCase().includes(query));
      return nameMatch || tagMatch;
    });

    // Clear results
    this.searchResults.innerHTML = "";

    // Add "Create Custom Node" button at the top (only when not filtering by port)
    if (!this.searchFilterPort && query === "") {
      const createCustomBtn = document.createElement("div");
      createCustomBtn.className = "search-result-item create-custom-node-btn";
      createCustomBtn.tabIndex = 0;

      const iconDiv = document.createElement("div");
      iconDiv.className = "search-result-color";
      iconDiv.style.background = "transparent";
      iconDiv.textContent = "+";
      iconDiv.style.color = "white";
      iconDiv.style.fontWeight = "bold";
      iconDiv.style.display = "flex";
      iconDiv.style.alignItems = "center";
      iconDiv.style.justifyContent = "center";
      iconDiv.style.fontSize = "16px";
      iconDiv.style.paddingBottom = "3px";
      createCustomBtn.appendChild(iconDiv);

      const nameDiv = document.createElement("div");
      nameDiv.className = "search-result-name";
      nameDiv.textContent = "Create Custom Node";
      nameDiv.style.fontWeight = "bold";
      createCustomBtn.appendChild(nameDiv);

      createCustomBtn.addEventListener("click", () => {
        this.hideSearchMenu();
        this.showCustomNodeModal();
      });

      createCustomBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.hideSearchMenu();
          this.showCustomNodeModal();
        }
      });

      this.searchResults.appendChild(createCustomBtn);
    }

    // Group results by category
    const categorizedResults = {};
    results.forEach(([key, nodeType]) => {
      const category = nodeType.category || "Misc";
      if (!categorizedResults[category]) {
        categorizedResults[category] = [];
      }
      categorizedResults[category].push([key, nodeType]);
    });

    // Sort categories
    const sortedCategories = Object.keys(categorizedResults).sort();

    // Determine if categories should be expanded (when there's a search query)
    const expandAll = query.length > 0;

    // Render each category
    sortedCategories.forEach((category) => {
      const categoryNodes = categorizedResults[category];

      // Create category header
      const categoryHeader = document.createElement("div");
      categoryHeader.className = "search-category-header";
      categoryHeader.textContent = category;
      categoryHeader.dataset.category = category;

      // Make category collapsible
      const isExpanded = expandAll;
      categoryHeader.classList.toggle("expanded", isExpanded);

      categoryHeader.addEventListener("click", () => {
        categoryHeader.classList.toggle("expanded");
        const categoryContent = categoryHeader.nextElementSibling;
        if (categoryContent) {
          categoryContent.classList.toggle("collapsed");
        }
      });

      this.searchResults.appendChild(categoryHeader);

      // Create category content container
      const categoryContent = document.createElement("div");
      categoryContent.className = "search-category-content";
      if (!isExpanded) {
        categoryContent.classList.add("collapsed");
      }

      // Add nodes in this category
      categoryNodes.forEach(([key, nodeType]) => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.dataset.nodeTypeKey = key;
        item.tabIndex = 0; // Make focusable

        // Color indicator
        const colorDiv = document.createElement("div");
        colorDiv.className = "search-result-color";
        colorDiv.style.background = nodeType.color;
        item.appendChild(colorDiv);

        // Name
        const nameDiv = document.createElement("div");
        nameDiv.className = "search-result-name";
        nameDiv.textContent = nodeType.name;
        item.appendChild(nameDiv);

        // Type info
        const typeDiv = document.createElement("div");
        typeDiv.className = "search-result-type";
        const inputCount = nodeType.inputs.length;
        const outputCount = nodeType.outputs.length;
        typeDiv.textContent = `${inputCount}→${outputCount}`;
        item.appendChild(typeDiv);

        // Click handler
        item.addEventListener("click", () => {
          this.selectNodeType(key, nodeType);
        });

        // Enter key handler
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            this.selectNodeType(key, nodeType);
          }
        });

        categoryContent.appendChild(item);
      });

      this.searchResults.appendChild(categoryContent);
    });

    // If no results
    if (results.length === 0) {
      const noResults = document.createElement("div");
      noResults.style.padding = "20px";
      noResults.style.textAlign = "center";
      noResults.style.color = "#888";
      noResults.textContent = "No nodes found";
      this.searchResults.appendChild(noResults);
    }
  }

  selectNodeType(key, nodeType) {
    const rect = this.canvas.getBoundingClientRect();
    // Convert screen coordinates to world coordinates
    const screenX = this.searchMenuPosition.x - rect.left;
    const screenY = this.searchMenuPosition.y - rect.top;
    const worldX = (screenX - this.camera.x) / this.camera.zoom;
    const worldY = (screenY - this.camera.y) / this.camera.zoom;

    let newNode;

    // Check if this is a uniform node
    if (key.startsWith("uniform_")) {
      const uniformId = nodeType.uniformId;
      const uniform = this.uniforms.find((u) => u.id === uniformId);
      if (uniform) {
        newNode = this.createUniformNode(uniform, worldX, worldY);
      }
    } else {
      newNode = this.addNode(worldX, worldY, nodeType);
    }

    // If we were dragging a wire, connect it to the new node
    if (this.searchFilterPort) {
      if (this.searchFilterType === "input") {
        // We were dragging from an input port
        // Connect to a compatible output port on the new node
        const compatibleOutput = newNode.outputPorts.find((port) =>
          this.searchFilterPort.canConnectTo(port)
        );
        if (compatibleOutput) {
          // Create a new wire from the output to the input
          const wire = new Wire(compatibleOutput, this.searchFilterPort);
          this.wires.push(wire);
          compatibleOutput.connections.push(wire);
          this.searchFilterPort.connections.push(wire);

          // Resolve generic types
          this.resolveGenericsForConnection(
            compatibleOutput,
            this.searchFilterPort
          );
        }
      } else {
        // We were dragging from an output port
        // Connect to a compatible input port on the new node
        const compatibleInput = newNode.inputPorts.find((port) =>
          this.searchFilterPort.canConnectTo(port)
        );
        if (compatibleInput) {
          // Remove existing connection if any
          if (compatibleInput.connections.length > 0) {
            const oldWire = compatibleInput.connections[0];
            this.wires = this.wires.filter((w) => w !== oldWire);
            oldWire.startPort.connections =
              oldWire.startPort.connections.filter((w) => w !== oldWire);
          }
          compatibleInput.connections = [];

          // Create a new wire from the output to the input
          const wire = new Wire(this.searchFilterPort, compatibleInput);
          this.wires.push(wire);
          this.searchFilterPort.connections.push(wire);
          compatibleInput.connections.push(wire);

          // Resolve generic types
          this.resolveGenericsForConnection(
            this.searchFilterPort,
            compatibleInput
          );
        }
      }
    }

    // Clear active wire
    this.activeWire = null;

    this.hideSearchMenu();
    this.render();
    this.updateDependencyList();
    this.onShaderChanged();
  }

  focusNextSearchResult() {
    const items = this.searchResults.querySelectorAll(".search-result-item");
    if (items.length === 0) return;

    const focused = document.activeElement;
    let index = Array.from(items).indexOf(focused);
    index = (index + 1) % items.length;
    items[index].focus();
  }

  focusPrevSearchResult() {
    const items = this.searchResults.querySelectorAll(".search-result-item");
    if (items.length === 0) return;

    const focused = document.activeElement;
    let index = Array.from(items).indexOf(focused);
    index = (index - 1 + items.length) % items.length;
    items[index].focus();
  }

  selectFocusedSearchResult() {
    const items = this.searchResults.querySelectorAll(".search-result-item");
    if (items.length === 0) return;

    // If input is focused, select first item
    if (document.activeElement === this.searchInput) {
      const key = items[0].dataset.nodeTypeKey;
      const nodeType = NODE_TYPES[key];
      this.selectNodeType(key, nodeType);
    } else {
      // Select the focused item
      const focused = document.activeElement;
      if (focused.classList.contains("search-result-item")) {
        const key = focused.dataset.nodeTypeKey;
        const nodeType = NODE_TYPES[key];
        this.selectNodeType(key, nodeType);
      }
    }
  }

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("contextmenu", (e) => this.onContextMenu(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });

    // Drag and drop for uniforms
    this.canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    this.canvas.addEventListener("drop", (e) => {
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
      const y = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

      // Check for uniform drop
      const uniformId = parseInt(e.dataTransfer.getData("uniformId"));
      if (uniformId) {
        const uniform = this.uniforms.find((u) => u.id === uniformId);
        if (uniform) {
          this.createUniformNode(uniform, x, y);
        }
        return;
      }

      // Check for custom node drop
      const customNodeId = parseInt(e.dataTransfer.getData("customNodeId"));
      if (customNodeId) {
        const customNode = this.customNodes.find((n) => n.id === customNodeId);
        if (customNode) {
          const nodeType = this.createNodeTypeFromCustomNode(customNode);
          this.addNode(x, y, nodeType);
        }
        return;
      }
    });

    // Keyboard events
    document.addEventListener("keydown", (e) => this.onKeyDown(e));

    document.getElementById("newBtn").addEventListener("click", () => {
      this.createNewFile();
    });

    document.getElementById("closeSidebarBtn").addEventListener("click", () => {
      this.closeSidebar();
    });

    document.getElementById("viewCodeBtn").addEventListener("click", () => {
      this.showViewCodeModal();
    });

    document.getElementById("exportBtn").addEventListener("click", () => {
      this.exportGLSL();
    });

    document.getElementById("reportIssueBtn").addEventListener("click", () => {
      window.open(
        "https://github.com/skymen/construct-shader-graph/issues/new",
        "_blank"
      );
    });

    document.getElementById("saveBtn").addEventListener("click", () => {
      this.saveToJSON();
    });

    document.getElementById("saveAsBtn").addEventListener("click", () => {
      this.fileHandle = null; // Clear handle to force "Save As"
      this.saveToJSON();
    });

    document.getElementById("loadBtn").addEventListener("click", async () => {
      // Try to use File System Access API if available
      if ('showOpenFilePicker' in window) {
        try {
          const [fileHandle] = await window.showOpenFilePicker({
            types: [{
              description: 'Shader Graph',
              accept: { 'application/json': ['.json'] },
            }],
            multiple: false,
          });
          
          const file = await fileHandle.getFile();
          this.fileHandle = fileHandle; // Store handle for future saves
          await this.loadFromJSON(file);
          return;
        } catch (error) {
          // User cancelled or error occurred, fall back to file input
          if (error.name !== 'AbortError') {
            console.warn('File System Access API failed, falling back to file input:', error);
          } else {
            return; // User cancelled, don't show file input
          }
        }
      }
      
      // Fallback to traditional file input
      document.getElementById("loadFileInput").click();
    });

    document.getElementById("loadFileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.fileHandle = null; // Clear file handle when using file input
        this.loadFromJSON(file);
        e.target.value = ""; // Reset input so same file can be loaded again
      }
    });
  }

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("open");
    if (sidebar.classList.contains("open")) {
      this.updateDependencyList();
    }
  }

  closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("open");
  }

  // Selection management
  clearSelection() {
    this.selectedNodes.forEach((node) => (node.isSelected = false));
    this.selectedRerouteNodes.forEach((rn) => (rn.isSelected = false));
    this.selectedNodes.clear();
    this.selectedRerouteNodes.clear();
  }

  selectNode(node, addToSelection = false) {
    if (!addToSelection) {
      this.clearSelection();
    }
    node.isSelected = true;
    this.selectedNodes.add(node);
  }

  deselectNode(node) {
    node.isSelected = false;
    this.selectedNodes.delete(node);
  }

  selectRerouteNode(rerouteNode, addToSelection = false) {
    if (!addToSelection) {
      this.clearSelection();
    }
    rerouteNode.isSelected = true;
    this.selectedRerouteNodes.add(rerouteNode);
  }

  deselectRerouteNode(rerouteNode) {
    rerouteNode.isSelected = false;
    this.selectedRerouteNodes.delete(rerouteNode);
  }

  deleteSelected() {
    // Delete selected nodes and their wires (except output node)
    this.selectedNodes.forEach((node) => {
      // Don't delete the output node
      if (node.nodeType === NODE_TYPES.output) {
        return;
      }

      // Remove all wires connected to this node
      const connectedWires = [];
      node.getAllPorts().forEach((port) => {
        connectedWires.push(...port.connections);
      });

      connectedWires.forEach((wire) => {
        this.disconnectWire(wire);
      });

      // Remove the node
      this.nodes = this.nodes.filter((n) => n !== node);
    });

    // Delete selected reroute nodes
    this.selectedRerouteNodes.forEach((rerouteNode) => {
      rerouteNode.wire.removeRerouteNode(rerouteNode);
    });

    this.clearSelection();
    this.render();
    this.updateDependencyList();
  }

  onKeyDown(e) {
    // Ignore if typing in input fields
    if (
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    ) {
      return;
    }

    // Ctrl/Cmd + N: New File
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.createNewFile();
    }
    // Ctrl/Cmd + S: Save
    else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveToJSON();
    }
    // Ctrl/Cmd + Shift + S: Save As (clear file handle)
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      this.fileHandle = null; // Clear handle to force "Save As"
      this.saveToJSON();
    }
    // Ctrl/Cmd + O: Open
    else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      document.getElementById("loadBtn").click();
    }
    else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      this.deleteSelected();
    }
  }

  onWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if this is a zoom gesture (Ctrl/Cmd key or pinch gesture)
    const isZoomGesture = e.ctrlKey || e.metaKey;

    if (isZoomGesture) {
      // Zoom mode
      // Calculate world position before zoom
      const worldX = (mouseX - this.camera.x) / this.camera.zoom;
      const worldY = (mouseY - this.camera.y) / this.camera.zoom;

      // Update zoom
      const zoomSpeed = 0.01;
      const delta = -e.deltaY * zoomSpeed;
      const newZoom = Math.max(
        0.1,
        Math.min(5, this.camera.zoom * (1 + delta))
      );

      // Adjust camera position to zoom towards mouse
      this.camera.x = mouseX - worldX * newZoom;
      this.camera.y = mouseY - worldY * newZoom;
      this.camera.zoom = newZoom;
    } else {
      // Pan mode
      this.camera.x -= e.deltaX;
      this.camera.y -= e.deltaY;
    }

    this.render();
  }

  buildDependencyGraph() {
    // Find the output node
    const outputNode = this.nodes.find(
      (node) => node.nodeType === NODE_TYPES.output
    );
    if (!outputNode) {
      return null;
    }

    // Build a graph of dependencies using BFS
    const visited = new Set();
    const dependencies = new Map(); // node -> Set of nodes it depends on
    const queue = [outputNode];
    visited.add(outputNode);

    while (queue.length > 0) {
      const node = queue.shift();
      const nodeDeps = new Set();

      // Check all input ports
      for (const port of node.inputPorts) {
        for (const wire of port.connections) {
          if (wire.startPort && wire.startPort.node) {
            const depNode = wire.startPort.node;
            nodeDeps.add(depNode);

            if (!visited.has(depNode)) {
              visited.add(depNode);
              queue.push(depNode);
            }
          }
        }
      }

      dependencies.set(node, nodeDeps);
    }

    return { outputNode, dependencies, connectedNodes: visited };
  }

  topologicalSort(dependencies, connectedNodes) {
    // Calculate in-degree for each node
    const inDegree = new Map();
    const adjList = new Map();

    for (const node of connectedNodes) {
      inDegree.set(node, 0);
      adjList.set(node, []);
    }

    // Build adjacency list and calculate in-degrees
    for (const [node, deps] of dependencies) {
      for (const dep of deps) {
        adjList.get(dep).push(node);
        inDegree.set(node, inDegree.get(node) + 1);
      }
    }

    // Group nodes by levels (execution order)
    const levels = [];
    const queue = [];

    // Start with nodes that have no dependencies (in-degree 0)
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const levelSize = queue.length;
      const currentLevel = [];

      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift();
        currentLevel.push(node);

        // Reduce in-degree for dependent nodes
        for (const dependent of adjList.get(node)) {
          const newDegree = inDegree.get(dependent) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  updateDependencyList() {
    const noOutputMsg = document.getElementById("no-output-msg");
    const dependencyList = document.getElementById("dependency-list");

    const graph = this.buildDependencyGraph();

    if (!graph) {
      noOutputMsg.style.display = "block";
      dependencyList.classList.remove("visible");
      return;
    }

    const levels = this.topologicalSort(
      graph.dependencies,
      graph.connectedNodes
    );

    noOutputMsg.style.display = "none";
    dependencyList.classList.add("visible");
    dependencyList.innerHTML = "";

    levels.forEach((level, index) => {
      const groupDiv = document.createElement("div");
      groupDiv.className = "dependency-group";

      const header = document.createElement("div");
      header.className = "dependency-group-header";
      if (index === 0) {
        header.textContent = "Leaf Nodes (No Dependencies)";
      } else if (index === levels.length - 1) {
        header.textContent = "Output";
      } else {
        header.textContent = `Level ${index}`;
      }
      groupDiv.appendChild(header);

      level.forEach((node) => {
        const nodeDiv = document.createElement("div");
        nodeDiv.className = "dependency-node";
        nodeDiv.style.borderLeftColor = node.headerColor;

        const titleDiv = document.createElement("div");
        titleDiv.className = "dependency-node-title";
        titleDiv.textContent = node.title;
        nodeDiv.appendChild(titleDiv);

        const typeDiv = document.createElement("div");
        typeDiv.className = "dependency-node-type";
        typeDiv.textContent = `ID: ${node.id}`;
        nodeDiv.appendChild(typeDiv);

        // Click to highlight node
        nodeDiv.addEventListener("click", () => {
          this.highlightNode(node);
        });

        groupDiv.appendChild(nodeDiv);
      });

      dependencyList.appendChild(groupDiv);
    });
  }

  highlightNode(node) {
    // Temporarily highlight the node
    const originalDragging = node.isDragging;
    node.isDragging = true;
    this.render();

    setTimeout(() => {
      node.isDragging = originalDragging;
      this.render();
    }, 500);
  }

  generateVariableNames(levels, target) {
    // Generate unique variable names for all ports
    const portToVarName = new Map();
    let varCounter = 0;

    // Process nodes in execution order
    for (const level of levels) {
      for (const node of level) {
        // Generate variable names for input ports
        for (let i = 0; i < node.inputPorts.length; i++) {
          const port = node.inputPorts[i];

          // Check if this port has a connection
          if (port.connections.length > 0) {
            const wire = port.connections[0];
            const sourcePort = wire.startPort;

            // Use the same variable name as the source output
            if (portToVarName.has(sourcePort)) {
              portToVarName.set(port, portToVarName.get(sourcePort));
            }
          } else {
            // No connection, use the port's value if editable
            if (port.isEditable && port.value !== undefined) {
              // Get the resolved type for generic ports
              const resolvedType = port.getResolvedType();
              // Use the toShaderValue function to format the value
              const value = toShaderValue(port.value, resolvedType, target);
              portToVarName.set(port, value);
            } else {
              // Generate a default variable name
              portToVarName.set(port, `var_${varCounter++}`);
            }
          }
        }

        // Generate variable names for output ports
        for (let i = 0; i < node.outputPorts.length; i++) {
          const port = node.outputPorts[i];
          if (!portToVarName.has(port)) {
            portToVarName.set(port, `var_${varCounter++}`);
          }
        }
      }
    }

    return portToVarName;
  }

  getBoilerplate(target) {
    const boilerplates = {
      webgl1: boilerplateWebGL1,
      webgl2: boilerplateWebGL2,
      webgpu: boilerplateWebGPU,
    };

    return boilerplates[target] || "";
  }

  generateUniformDeclarations(target) {
    if (this.uniforms.length === 0) return "";

    let declarations = "\n// Shader Parameters (Uniforms)\n";

    if (target === "webgpu") {
      // WebGPU uses a uniform struct
      declarations += "struct ShaderParams {\n";
      this.uniforms.forEach((uniform) => {
        if (uniform.type === "color") {
          declarations += `\t${uniform.variableName} : vec3<f32>,\n`;
        } else {
          // float type
          declarations += `\t${uniform.variableName} : f32,\n`;
        }
      });
      declarations += "};\n";
      declarations +=
        "%%SHADERPARAMS_BINDING%% var<uniform> shaderParams : ShaderParams;\n\n";
    } else {
      // WebGL 1 and 2 use individual uniform declarations
      this.uniforms.forEach((uniform) => {
        if (uniform.type === "color") {
          declarations += `uniform vec3 ${uniform.variableName};\n`;
        } else {
          declarations += `uniform float ${uniform.variableName};\n`;
        }
      });
      declarations += "\n";
    }

    return declarations;
  }

  generateShader(target, levels, portToVarName) {
    let shader = "";

    // Collect unique dependencies for this target
    const dependencies = new Set();
    for (const level of levels) {
      for (const node of level) {
        // Check if getDependency exists (some dynamically created nodes might not have it)
        if (typeof node.nodeType.getDependency === "function") {
          const dep = node.nodeType.getDependency(target);
          if (dep) {
            dependencies.add(dep);
          }
        } else if (
          node.nodeType.shaderCode &&
          node.nodeType.shaderCode[target]
        ) {
          // Fallback for nodes without getDependency method
          const dep = node.nodeType.shaderCode[target].dependency;
          if (dep) {
            dependencies.add(dep);
          }
        }
      }
    }

    // Add dependencies
    if (dependencies.size > 0) {
      shader += "\n// Function dependencies\n";
      for (const dep of dependencies) {
        shader += dep + "\n\n";
      }
    }

    // Generate execution code for each node in order
    const isWebGPU = target === "webgpu";

    if (!isWebGPU) {
      shader += "\nvoid main() {\n";
    } else {
      shader += "\n@fragment\n";
      shader += "fn main(input : FragmentInput) -> FragmentOutput {\n";
      shader += "    var output : FragmentOutput;\n";
    }

    for (const level of levels) {
      for (const node of level) {
        let execution = null;

        // Check if getExecution exists (some dynamically created nodes might not have it)
        if (typeof node.nodeType.getExecution === "function") {
          execution = node.nodeType.getExecution(target);
        } else if (
          node.nodeType.shaderCode &&
          node.nodeType.shaderCode[target]
        ) {
          // Fallback for nodes without getExecution method
          execution = node.nodeType.shaderCode[target].execution;
        }

        if (execution) {
          // Get input variable names
          const inputVars = node.inputPorts.map(
            (port) => portToVarName.get(port) || "0.0"
          );

          // Get output variable names
          const outputVars = node.outputPorts.map((port) =>
            portToVarName.get(port)
          );

          // Generate code
          const code = execution(inputVars, outputVars, node);
          shader += code + "\n";
        }
      }
    }

    if (!isWebGPU) {
      shader += "}\n";
    } else {
      shader += "}\n"; // Close the fragment function
    }

    return shader;
  }

  showViewCodeModal() {
    const graph = this.buildDependencyGraph();

    if (!graph) {
      alert("No output node found. Cannot generate shader.");
      return;
    }

    const levels = this.topologicalSort(
      graph.dependencies,
      graph.connectedNodes
    );

    // Generate shaders for all targets
    const targets = ["webgl1", "webgl2", "webgpu"];
    const shaders = {};

    for (const target of targets) {
      const portToVarName = this.generateVariableNames(levels, target);
      const boilerplate = this.getBoilerplate(target);
      const uniformDeclarations = this.generateUniformDeclarations(target);
      const shaderCode = this.generateShader(target, levels, portToVarName);
      const fullShader = boilerplate + uniformDeclarations + shaderCode;
      shaders[target] = fullShader;
    }

    // Populate the modal with the generated code
    document.getElementById("code-webgl1-content").textContent = shaders.webgl1;
    document.getElementById("code-webgl2-content").textContent = shaders.webgl2;
    document.getElementById("code-webgpu-content").textContent = shaders.webgpu;

    // Show the modal
    document.getElementById("viewCodeModal").style.display = "flex";
  }

  async exportGLSL() {
    const graph = this.buildDependencyGraph();

    if (!graph) {
      alert("No output node found. Cannot generate shader.");
      return;
    }

    const levels = this.topologicalSort(
      graph.dependencies,
      graph.connectedNodes
    );

    // Create ZIP file
    const zip = new JSZip();

    // Generate shaders for all targets
    const targets = ["webgl1", "webgl2", "webgpu"];
    const shaders = {};

    for (const target of targets) {
      // Generate variable names for this specific target
      const portToVarName = this.generateVariableNames(levels, target);
      const boilerplate = this.getBoilerplate(target);
      const uniformDeclarations = this.generateUniformDeclarations(target);
      const shaderCode = this.generateShader(target, levels, portToVarName);
      const fullShader = boilerplate + uniformDeclarations + shaderCode;
      shaders[target] = fullShader;

      // Log to console
      console.log(`Generated ${target.toUpperCase()} Shader:`);
      console.log(fullShader);
      console.log("---");
    }

    // Add shader files to ZIP
    zip.file("effect.fx", shaders.webgl1);
    zip.file("effect.webgl2.fx", shaders.webgl2);
    zip.file("effect.wgsl", shaders.webgpu);

    // Generate addon.json
    const addonJson = this.generateAddonJson();
    zip.file("addon.json", JSON.stringify(addonJson, null, "\t"));

    // Generate lang/en-US.json
    const langJson = this.generateLangJson();
    zip.file("lang/en-US.json", JSON.stringify(langJson, null, "\t"));

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Use sanitized name for the download filename
    const addonId = this.sanitizeAddonId(
      this.shaderSettings.name || "MyEffect"
    );
    a.download = `${addonId}.c3addon`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  sanitizeAddonId(name) {
    // Convert to lowercase and replace spaces/special chars with underscores
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  generateAddonJson() {
    const settings = this.shaderSettings;

    // Generate addon ID from author and name
    const author = settings.author || "MyCompany";
    const name = settings.name || "MyEffect";
    const addonId = `${this.sanitizeVariableName(
      author
    )}_${this.sanitizeVariableName(name)}`;

    return {
      "is-c3-addon": true,
      type: "effect",
      name: name,
      id: addonId,
      version: settings.version || "1.0.0.0",
      author: author,
      website: settings.website || "https://www.construct.net",
      documentation: settings.documentation || "https://www.construct.net",
      description: settings.description || "no description",
      "file-list": [
        "lang/en-US.json",
        "addon.json",
        "effect.fx",
        "effect.webgl2.fx",
        "effect.wgsl",
      ],
      "supported-renderers": ["webgl", "webgl2", "webgpu"],
      category: settings.category || "color",
      "blends-background": settings.blendsBackground || false,
      "cross-sampling": settings.crossSampling || false,
      "preserves-opaqueness": settings.preservesOpaqueness || false,
      animated: settings.animated || false,
      "is-deprecated": settings.isDeprecated || false,
      "extend-box": {
        horizontal: settings.extendBoxH || 0,
        vertical: settings.extendBoxV || 0,
      },
      parameters: this.generateParametersJson(),
    };
  }

  generateParametersJson() {
    return this.uniforms.map((uniform) => {
      const param = {
        id: uniform.variableName,
        name: uniform.name,
        desc: uniform.description || "",
        type:
          uniform.type === "color"
            ? "color"
            : uniform.isPercent
            ? "percent"
            : "float",
      };

      // Add initial value
      if (uniform.type === "color") {
        param.initial = [uniform.value.r, uniform.value.g, uniform.value.b];
      } else {
        param.initial = uniform.value;
      }

      return param;
    });
  }

  generateLangJson() {
    const settings = this.shaderSettings;
    const author = settings.author || "MyCompany";
    const name = settings.name || "MyEffect";
    const addonId = `${this.sanitizeVariableName(
      author
    )}_${this.sanitizeVariableName(name)}`.toLowerCase();

    const langData = {
      languageTag: "en-US",
      fileDescription: `Strings for ${name}.`,
      text: {
        effects: {
          [addonId]: {
            name: name,
            description: settings.description || "No description",
          },
        },
      },
    };

    // Add parameter strings if there are uniforms
    if (this.uniforms.length > 0) {
      const params = {};
      this.uniforms.forEach((uniform) => {
        params[uniform.variableName] = {
          name: uniform.name,
          desc: uniform.description || "",
        };
      });
      langData.text.effects[addonId].parameters = params;
    }

    return langData;
  }

  createNewFile() {
    // Clear file handle to start fresh
    this.fileHandle = null;
    
    // Clear all nodes and wires
    this.nodes = [];
    this.wires = [];
    this.selectedNodes.clear();
    this.selectedRerouteNodes.clear();
    
    // Reset shader settings to defaults
    this.shaderSettings = {
      name: "",
      version: "1.0.0.0",
      author: "",
      website: "",
      documentation: "",
      description: "",
      category: "color",
      blendsBackground: false,
      crossSampling: false,
      preservesOpaqueness: true,
      animated: false,
      isDeprecated: false,
      extendBoxH: 0,
      extendBoxV: 0,
    };
    this.updateShaderSettingsUI();
    
    // Clear uniforms
    this.uniforms = [];
    this.uniformIdCounter = 1;
    this.renderUniformList();
    
    // Clear custom nodes
    this.customNodes = [];
    this.customNodeIdCounter = 1;
    this.renderCustomNodesList();
    
    // Reset camera
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
    };
    
    // Reset node ID counter
    this.nodeIdCounter = 1;
    
    // Re-add the output node
    this.addNode(600, 300, NODE_TYPES.output);
    
    this.render();
    this.updateDependencyList();
    this.onShaderChanged();
  }

  async saveToJSON() {
    // Create a complete snapshot of the blueprint state
    const data = {
      version: "1.0.0",
      shaderSettings: this.shaderSettings,
      uniforms: this.uniforms,
      customNodes: this.customNodes,
      camera: {
        x: this.camera.x,
        y: this.camera.y,
        zoom: this.camera.zoom,
      },
      nodes: this.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        nodeTypeKey: this.getNodeTypeKey(node.nodeType),
        title: node.title,
        operation: node.operation,
        uniformName: node.uniformName,
        uniformDisplayName: node.uniformDisplayName,
        uniformVariableName: node.uniformVariableName,
        uniformId: node.uniformId,
        isVariable: node.isVariable,
        inputPorts: node.inputPorts.map((port) => ({
          name: port.name,
          portType: port.portType,
          value: port.value,
        })),
        outputPorts: node.outputPorts.map((port) => ({
          name: port.name,
          portType: port.portType,
        })),
      })),
      wires: this.wires.map((wire) => ({
        startNodeId: wire.startPort.node.id,
        startPortIndex: wire.startPort.node.outputPorts.indexOf(wire.startPort),
        endNodeId: wire.endPort.node.id,
        endPortIndex: wire.endPort.node.inputPorts.indexOf(wire.endPort),
        rerouteNodes: wire.rerouteNodes.map((rn) => ({
          x: rn.x,
          y: rn.y,
        })),
      })),
      nodeIdCounter: this.nodeIdCounter,
      uniformIdCounter: this.uniformIdCounter,
      customNodeIdCounter: this.customNodeIdCounter,
    };

    const json = JSON.stringify(data, null, 2);
    
    // Try to use File System Access API if available
    if ('showSaveFilePicker' in window) {
      try {
        const filename = this.shaderSettings.name
          ? `${this.sanitizeAddonId(this.shaderSettings.name)}.json`
          : "blueprint.json";
        
        // If we have an existing file handle, try to reuse it
        let handle = this.fileHandle;
        
        // If no handle or user wants to save as new file, show picker
        if (!handle) {
          handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Shader Graph',
              accept: { 'application/json': ['.json'] },
            }],
          });
          this.fileHandle = handle;
        }
        
        // Write to the file
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        
        console.log('Blueprint saved successfully using File System Access API');
        return;
      } catch (error) {
        // User cancelled or error occurred, fall back to download
        if (error.name !== 'AbortError') {
          console.warn('File System Access API failed, falling back to download:', error);
        }
      }
    }
    
    // Fallback to traditional download method
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const filename = this.shaderSettings.name
      ? `${this.sanitizeAddonId(this.shaderSettings.name)}.json`
      : "blueprint.json";
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async loadFromJSON(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate version
      if (!data.version) {
        throw new Error("Invalid blueprint file: missing version");
      }

      // Clear current state
      this.nodes = [];
      this.wires = [];
      this.selectedNodes.clear();
      this.selectedRerouteNodes.clear();

      // Restore shader settings
      if (data.shaderSettings) {
        this.shaderSettings = {
          ...this.shaderSettings,
          ...data.shaderSettings,
        };
        this.updateShaderSettingsUI();
      }

      // Restore uniforms
      if (data.uniforms) {
        this.uniforms = data.uniforms;
        this.uniformIdCounter =
          data.uniformIdCounter || this.uniforms.length + 1;
        this.renderUniformList();
      }

      // Restore custom nodes
      if (data.customNodes) {
        this.customNodes = data.customNodes;
        this.customNodeIdCounter =
          data.customNodeIdCounter || this.customNodes.length + 1;
        this.renderCustomNodesList();
      }

      // Restore camera
      if (data.camera) {
        this.camera = data.camera;
      }

      // Restore nodes
      const nodeMap = new Map(); // Map old IDs to new node objects

      if (data.nodes) {
        for (const nodeData of data.nodes) {
          // Special handling for uniform nodes - use the saved uniformId
          let nodeType;
          if (
            nodeData.nodeTypeKey &&
            nodeData.nodeTypeKey.startsWith("uniform_") &&
            nodeData.uniformId !== undefined
          ) {
            const uniform = this.uniforms.find(
              (u) => u.id === nodeData.uniformId
            );
            if (uniform) {
              nodeType =
                uniform.type === "color" ? UniformColorNode : UniformFloatNode;
              // Add uniform metadata to nodeType
              nodeType = {
                ...nodeType,
                name: uniform.name,
                isUniform: true,
                uniformId: uniform.id,
                uniformName: uniform.name,
              };
            } else {
              console.warn(`Uniform with ID ${nodeData.uniformId} not found`);
              continue;
            }
          } else {
            nodeType = this.getNodeTypeFromKey(nodeData.nodeTypeKey);
            if (!nodeType) {
              console.warn(`Unknown node type: ${nodeData.nodeTypeKey}`);
              continue;
            }
          }

          const node = new Node(nodeData.x, nodeData.y, nodeData.id, nodeType);

          // Restore node properties
          if (nodeData.title) node.title = nodeData.title;
          if (nodeData.operation) node.operation = nodeData.operation;
          if (nodeData.uniformName) node.uniformName = nodeData.uniformName;
          if (nodeData.uniformDisplayName)
            node.uniformDisplayName = nodeData.uniformDisplayName;
          if (nodeData.uniformVariableName)
            node.uniformVariableName = nodeData.uniformVariableName;
          if (nodeData.uniformId !== undefined)
            node.uniformId = nodeData.uniformId;
          if (nodeData.isVariable !== undefined)
            node.isVariable = nodeData.isVariable;

          // Restore port values
          nodeData.inputPorts.forEach((portData, index) => {
            if (node.inputPorts[index] && portData.value !== undefined) {
              node.inputPorts[index].value = portData.value;
            }
          });

          nodeMap.set(nodeData.id, node);
          this.nodes.push(node);
        }
      }

      // Restore wires
      if (data.wires) {
        for (const wireData of data.wires) {
          const startNode = nodeMap.get(wireData.startNodeId);
          const endNode = nodeMap.get(wireData.endNodeId);

          if (!startNode || !endNode) {
            console.warn("Wire references missing nodes");
            continue;
          }

          const startPort = startNode.outputPorts[wireData.startPortIndex];
          const endPort = endNode.inputPorts[wireData.endPortIndex];

          if (!startPort || !endPort) {
            console.warn("Wire references missing ports");
            continue;
          }

          const wire = new Wire(startPort, endPort);

          // Restore reroute nodes
          if (wireData.rerouteNodes) {
            wireData.rerouteNodes.forEach((rnData) => {
              const rerouteNode = new RerouteNode(rnData.x, rnData.y, wire);
              wire.rerouteNodes.push(rerouteNode);
            });
          }

          this.wires.push(wire);
          startPort.connections.push(wire);
          endPort.connections.push(wire);
        }
      }

      // Restore counters
      if (data.nodeIdCounter) {
        this.nodeIdCounter = data.nodeIdCounter;
      }

      this.render();
      this.updateDependencyList();

      console.log("Blueprint loaded successfully");

      // Refresh preview with loaded shader (delay to ensure render is complete)
      setTimeout(() => {
        this.onShaderChanged();
      }, 100);
    } catch (error) {
      console.error("Failed to load blueprint:", error);
      alert(`Failed to load blueprint: ${error.message}`);
    }
  }

  getNodeTypeKey(nodeType) {
    // Check if it's a custom node
    if (nodeType.isCustom && nodeType.customNodeId) {
      return `custom_${nodeType.customNodeId}`;
    }

    // Check if it's a uniform node
    if (nodeType.isUniform && nodeType.uniformId) {
      return `uniform_${nodeType.uniformId}`;
    }

    // Find the key for this node type in NODE_TYPES
    for (const [key, type] of Object.entries(NODE_TYPES)) {
      if (type === nodeType) {
        return key;
      }
    }

    return null;
  }

  getNodeTypeFromKey(key) {
    // Handle null or undefined keys
    if (!key) {
      return null;
    }

    // Check if it's a custom node
    if (key.startsWith("custom_")) {
      const customNodeId = parseInt(key.replace("custom_", ""));
      const customNode = this.customNodes.find((n) => n.id === customNodeId);
      if (customNode) {
        return this.createNodeTypeFromCustomNode(customNode);
      }
    }

    // Check uniform nodes
    const uniformNodeTypes = this.getUniformNodeTypes();
    if (uniformNodeTypes[key]) {
      return uniformNodeTypes[key];
    }

    // Check built-in nodes
    return NODE_TYPES[key] || null;
  }

  updateShaderSettingsUI() {
    // Update all shader settings input fields
    const fields = {
      settingName: "name",
      settingVersion: "version",
      settingAuthor: "author",
      settingWebsite: "website",
      settingDocumentation: "documentation",
      settingDescription: "description",
      settingCategory: "category",
      settingBlendsBackground: "blendsBackground",
      settingCrossSampling: "crossSampling",
      settingPreservesOpaqueness: "preservesOpaqueness",
      settingAnimated: "animated",
      settingIsDeprecated: "isDeprecated",
      settingExtendBoxH: "extendBoxH",
      settingExtendBoxV: "extendBoxV",
    };

    for (const [elementId, settingKey] of Object.entries(fields)) {
      const element = document.getElementById(elementId);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = this.shaderSettings[settingKey];
        } else {
          element.value = this.shaderSettings[settingKey];
        }
      }
    }
  }

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Transform screen coordinates to world coordinates
    return {
      x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
      y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom,
    };
  }

  getScreenPos(worldX, worldY) {
    // Transform world coordinates to screen coordinates
    return {
      x: worldX * this.camera.zoom + this.camera.x,
      y: worldY * this.camera.zoom + this.camera.y,
    };
  }

  addNode(x, y, nodeType = NODE_TYPES.math) {
    const node = new Node(x, y, this.nodeIdCounter++, nodeType);
    this.nodes.push(node);
    this.render();
    return node;
  }

  findPortAtPosition(x, y) {
    for (const node of this.nodes) {
      for (const port of node.getAllPorts()) {
        if (port.isPointInside(x, y)) {
          return port;
        }
      }
    }
    return null;
  }

  findNodeAtPosition(x, y) {
    // Check in reverse order so top nodes are selected first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (this.nodes[i].isPointInside(x, y)) {
        return this.nodes[i];
      }
    }
    return null;
  }

  findRerouteNodeAtPosition(x, y) {
    for (const wire of this.wires) {
      for (const rerouteNode of wire.rerouteNodes) {
        if (rerouteNode.isPointInside(x, y)) {
          return rerouteNode;
        }
      }
    }
    return null;
  }

  findWireAtPosition(x, y) {
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const result = this.wires[i].isPointNearWire(x, y);
      if (result) {
        return { wire: this.wires[i], ...result };
      }
    }
    return null;
  }

  disconnectWire(wire) {
    // Remove wire from connections
    if (wire.startPort) {
      const index = wire.startPort.connections.indexOf(wire);
      if (index > -1) wire.startPort.connections.splice(index, 1);

      // Re-evaluate resolved generics if needed
      if (isGenericType(wire.startPort.portType)) {
        this.reevaluateGenericType(
          wire.startPort.node,
          wire.startPort.portType
        );
      }

      // Update editability after disconnection
      wire.startPort.updateEditability();

      // Update editability for all input ports on the same node
      wire.startPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });

      // Recalculate node height
      wire.startPort.node.recalculateHeight();
    }
    if (wire.endPort) {
      const index = wire.endPort.connections.indexOf(wire);
      if (index > -1) wire.endPort.connections.splice(index, 1);

      // Re-evaluate resolved generics if needed
      if (isGenericType(wire.endPort.portType)) {
        this.reevaluateGenericType(wire.endPort.node, wire.endPort.portType);
      }

      // Update editability after disconnection
      wire.endPort.updateEditability();

      // Update editability for all input ports on the same node
      wire.endPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });

      // Recalculate node height
      wire.endPort.node.recalculateHeight();
    }
    // Remove from wires array
    const wireIndex = this.wires.indexOf(wire);
    if (wireIndex > -1) this.wires.splice(wireIndex, 1);
    this.onShaderChanged();
  }

  reevaluateGenericType(node, genericType, visited = new Set()) {
    // Prevent infinite loops
    const nodeKey = `${node.id}_${genericType}`;
    if (visited.has(nodeKey)) return;
    visited.add(nodeKey);

    // Get all ports with this generic type
    const genericPorts = node
      .getAllPorts()
      .filter((port) => port.portType === genericType);

    // Find all connected concrete types
    const connectedConcreteTypes = new Set();
    const connectedGenericNodes = [];

    genericPorts.forEach((port) => {
      port.connections.forEach((wire) => {
        const connectedPort =
          wire.startPort === port ? wire.endPort : wire.startPort;
        if (connectedPort) {
          // Check if the connected port is generic
          if (isGenericType(connectedPort.portType)) {
            // Track connected generic nodes for re-evaluation
            connectedGenericNodes.push({
              node: connectedPort.node,
              genericType: connectedPort.portType,
            });

            // Also check if it has a concrete resolution we can use
            const resolvedType = connectedPort.node.resolveGenericType(
              connectedPort.portType
            );
            if (resolvedType) {
              const resolvedTypeDef = PORT_TYPES[resolvedType];
              if (
                !resolvedTypeDef?.isComposite &&
                !isGenericType(resolvedType)
              ) {
                connectedConcreteTypes.add(resolvedType);
              }
            }
          } else {
            // Non-generic port - use its type directly
            const connectedType = connectedPort.portType;
            const connectedTypeDef = PORT_TYPES[connectedType];

            // Only consider concrete types (not composite)
            if (!connectedTypeDef?.isComposite) {
              connectedConcreteTypes.add(connectedType);
            }
          }
        }
      });
    });

    const oldResolution = node.resolvedGenerics[genericType];
    let resolutionChanged = false;

    // If no concrete types found, clear the resolution
    if (connectedConcreteTypes.size === 0) {
      if (oldResolution) {
        delete node.resolvedGenerics[genericType];
        resolutionChanged = true;

        // Update editability for all ports with this generic type
        genericPorts.forEach((port) => {
          port.updateEditability();
        });
      }
    }
    // If exactly one concrete type, use it
    else if (connectedConcreteTypes.size === 1) {
      const concreteType = Array.from(connectedConcreteTypes)[0];

      if (oldResolution !== concreteType) {
        node.resolvedGenerics[genericType] = concreteType;
        resolutionChanged = true;

        // Propagate new resolution
        this.propagateGenericResolution(node, genericType, concreteType);

        // Update editability for all ports with this generic type
        genericPorts.forEach((port) => {
          port.updateEditability();
        });
      }
    }
    // If multiple concrete types, this is an error state (shouldn't happen)
    // Keep the first one found
    else {
      const concreteType = Array.from(connectedConcreteTypes)[0];
      if (oldResolution !== concreteType) {
        node.resolvedGenerics[genericType] = concreteType;
        resolutionChanged = true;
      }
    }

    // Always re-evaluate connected generic nodes if our resolution changed
    if (resolutionChanged) {
      connectedGenericNodes.forEach(
        ({ node: connectedNode, genericType: connectedGenericType }) => {
          this.reevaluateGenericType(
            connectedNode,
            connectedGenericType,
            visited
          );
        }
      );
    }
  }

  resolveGenericsForConnection(outputPort, inputPort) {
    // Get the actual types (resolved if generic)
    const outputType = outputPort.getResolvedType();
    const inputType = inputPort.getResolvedType();

    // Determine the concrete type to use for resolution
    // If one side is composite and the other is concrete, use the concrete type
    const outputTypeDef = PORT_TYPES[outputType];
    const inputTypeDef = PORT_TYPES[inputType];

    let concreteTypeForOutput = inputType;
    let concreteTypeForInput = outputType;

    // If input is composite but output is concrete, use output's concrete type
    if (inputTypeDef?.isComposite && !outputTypeDef?.isComposite) {
      concreteTypeForOutput = outputType;
    }

    // If output is composite but input is concrete, use input's concrete type
    if (outputTypeDef?.isComposite && !inputTypeDef?.isComposite) {
      concreteTypeForInput = inputType;
    }

    // If both are composite, we can't resolve (shouldn't happen with proper filtering)
    if (outputTypeDef?.isComposite && inputTypeDef?.isComposite) {
      return;
    }

    // Update output node's generics with the concrete type
    if (isGenericType(outputPort.portType)) {
      const wasUpdated = outputPort.node.updateResolvedGenerics(
        outputPort.portType,
        concreteTypeForOutput
      );

      // Propagate resolution to connected generic ports
      if (wasUpdated) {
        this.propagateGenericResolution(
          outputPort.node,
          outputPort.portType,
          concreteTypeForOutput
        );
      }

      // Update editability after connection
      outputPort.updateEditability();

      // Update editability for all input ports on the same node
      outputPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });

      // Recalculate node height
      outputPort.node.recalculateHeight();
    }

    // Update input node's generics with the concrete type
    if (isGenericType(inputPort.portType)) {
      const wasUpdated = inputPort.node.updateResolvedGenerics(
        inputPort.portType,
        concreteTypeForInput
      );

      // Propagate resolution to connected generic ports
      if (wasUpdated) {
        this.propagateGenericResolution(
          inputPort.node,
          inputPort.portType,
          concreteTypeForInput
        );
      }

      // Update editability after connection
      inputPort.updateEditability();

      // Update editability for all input ports on the same node
      inputPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });

      // Recalculate node height
      inputPort.node.recalculateHeight();
    }

    // Also update editability for non-generic ports that might have been affected
    if (!isGenericType(outputPort.portType)) {
      outputPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });
    }
    if (!isGenericType(inputPort.portType)) {
      inputPort.node.inputPorts.forEach((port) => {
        port.updateEditability();
      });
    }
  }

  propagateGenericResolution(node, genericType, concreteType) {
    // Get all ports of this node with the same generic type
    const genericPorts = node
      .getAllPorts()
      .filter((port) => port.portType === genericType);

    // For each generic port, propagate to connected nodes
    genericPorts.forEach((port) => {
      // Update editability for this port
      port.updateEditability();

      port.connections.forEach((wire) => {
        const connectedPort =
          wire.startPort === port ? wire.endPort : wire.startPort;

        if (connectedPort && isGenericType(connectedPort.portType)) {
          // Check if the connected node hasn't resolved this generic yet
          const connectedNode = connectedPort.node;
          const currentResolution = connectedNode.resolveGenericType(
            connectedPort.portType
          );

          if (!currentResolution) {
            // Resolve the connected node's generic
            const wasUpdated = connectedNode.updateResolvedGenerics(
              connectedPort.portType,
              concreteType
            );

            // Recursively propagate
            if (wasUpdated) {
              this.propagateGenericResolution(
                connectedNode,
                connectedPort.portType,
                concreteType
              );
            }
          }
        }
      });
    });
  }

  onMouseDown(e) {
    // Close any open editors if clicking outside of them
    if (this.editingPort) {
      const pos = this.getMousePos(e);
      const bounds = this.editingPort.getValueBoxBounds(this.ctx);

      // Check if clicking outside the value box
      if (
        bounds &&
        !this.editingPort.isPointInValueBox(pos.x, pos.y, this.ctx)
      ) {
        this.finishEditingPort();
      }
    }

    // Close custom input editor if clicking outside
    if (this.editingCustomInput) {
      const pos = this.getMousePos(e);
      const bounds = this.editingCustomInput.getCustomInputBounds();

      // Check if clicking outside the input bounds
      if (
        pos.x < bounds.x ||
        pos.x > bounds.x + bounds.width ||
        pos.y < bounds.y ||
        pos.y > bounds.y + bounds.height
      ) {
        this.finishEditingCustomInput();
      }
    }

    // Handle middle-click panning
    if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      const rect = this.canvas.getBoundingClientRect();
      this.panStart = {
        x: e.clientX - rect.left - this.camera.x,
        y: e.clientY - rect.top - this.camera.y,
      };
      this.canvas.style.cursor = "grabbing";
      return;
    }

    const pos = this.getMousePos(e);
    const currentTime = Date.now();
    const isMultiSelect = e.shiftKey;

    // Check for double-click on wire
    const timeSinceLastClick = currentTime - this.lastClickTime;
    const distanceFromLastClick = Math.sqrt(
      Math.pow(pos.x - this.lastClickPos.x, 2) +
        Math.pow(pos.y - this.lastClickPos.y, 2)
    );

    // If this is the second click of a double-click (within 300ms and close to same position)
    if (timeSinceLastClick < 300 && distanceFromLastClick < 10) {
      const wireHit = this.findWireAtPosition(pos.x, pos.y);
      if (wireHit) {
        const { wire, segmentIndex } = wireHit;
        // Add a reroute node at this position
        const rerouteNode = wire.addRerouteNode(pos.x, pos.y);

        // Insert at the correct position based on segment
        if (segmentIndex < wire.rerouteNodes.length - 1) {
          // Move the new node to the correct position in the array
          wire.rerouteNodes.splice(wire.rerouteNodes.length - 1, 1);
          wire.rerouteNodes.splice(segmentIndex, 0, rerouteNode);
          // Update indices
          wire.rerouteNodes.forEach((n, i) => {
            n.index = i;
          });
        }

        // Immediately start dragging the new reroute node
        this.draggedRerouteNode = rerouteNode;
        rerouteNode.isDragging = true;
        this.render();
        return;
      }
    }

    // Update last click info
    this.lastClickTime = currentTime;
    this.lastClickPos = { x: pos.x, y: pos.y };

    // Check if clicking on a reroute node
    const rerouteNode = this.findRerouteNodeAtPosition(pos.x, pos.y);
    if (rerouteNode) {
      // Handle selection
      if (isMultiSelect) {
        if (rerouteNode.isSelected) {
          this.deselectRerouteNode(rerouteNode);
        } else {
          this.selectRerouteNode(rerouteNode, true);
        }
      } else {
        if (!rerouteNode.isSelected) {
          this.selectRerouteNode(rerouteNode, false);
        }
      }

      // Start dragging if selected
      if (rerouteNode.isSelected) {
        this.draggedRerouteNode = rerouteNode;
        rerouteNode.isDragging = true;

        // Store initial positions for all selected reroute nodes
        this.selectedRerouteNodes.forEach((rn) => {
          rn.dragStartX = rn.x;
          rn.dragStartY = rn.y;
        });

        // Store drag offsets for all selected nodes
        this.selectedNodes.forEach((node) => {
          node.dragOffsetX = rerouteNode.x - node.x;
          node.dragOffsetY = rerouteNode.y - node.y;
        });
      }
      this.render();
      return;
    }

    // Check if clicking on an operation dropdown
    for (const node of this.nodes) {
      if (node.nodeType.hasOperation) {
        const dropdown = node.getOperationDropdownBounds();
        if (
          pos.x >= dropdown.x &&
          pos.x <= dropdown.x + dropdown.width &&
          pos.y >= dropdown.y &&
          pos.y <= dropdown.y + dropdown.height
        ) {
          this.showOperationMenu(node, dropdown);
          return;
        }
      }
    }

    // Check if clicking on a custom input field
    for (const node of this.nodes) {
      if (node.nodeType.hasCustomInput) {
        const inputBounds = node.getCustomInputBounds();
        if (
          pos.x >= inputBounds.x &&
          pos.x <= inputBounds.x + inputBounds.width &&
          pos.y >= inputBounds.y &&
          pos.y <= inputBounds.y + inputBounds.height
        ) {
          this.startEditingCustomInput(node);
          return;
        }
      }
    }

    // Check if clicking on a value box for editable ports
    for (const node of this.nodes) {
      for (const port of node.inputPorts) {
        if (
          port.isEditable &&
          port.connections.length === 0 &&
          port.isPointInValueBox(pos.x, pos.y, this.ctx)
        ) {
          this.startEditingPort(port);
          return;
        }
      }
    }

    // Check if clicking on a port
    const port = this.findPortAtPosition(pos.x, pos.y);
    if (port) {
      // If it's an input port with an existing connection, pick up that wire
      if (port.type === "input" && port.connections.length > 0) {
        const existingWire = port.connections[0];
        // Remove the wire from the input port
        port.connections = [];
        // Start dragging from the output port
        this.activeWire = existingWire;

        this.disconnectWire(existingWire);

        this.activeWire.endPort = null;
        this.activeWire.tempEndX = pos.x;
        this.activeWire.tempEndY = pos.y;
        this.activeWire.wasPickedUp = true; // Mark as picked up to avoid showing search menu
      }
      // Start creating a wire from output ports
      else if (port.type === "output") {
        this.activeWire = new Wire(port);
        this.activeWire.tempEndX = pos.x;
        this.activeWire.tempEndY = pos.y;
      }
      // Start creating a wire from input ports (dragging backwards)
      else if (port.type === "input") {
        // Create a temporary wire that we'll reverse later
        this.activeWire = new Wire(port);
        this.activeWire.tempEndX = pos.x;
        this.activeWire.tempEndY = pos.y;
        this.activeWire.isReversed = true; // Flag to indicate this is backwards
      }
      return;
    }

    // Check if clicking on a node
    const node = this.findNodeAtPosition(pos.x, pos.y);
    if (node) {
      // Handle selection
      if (isMultiSelect) {
        if (node.isSelected) {
          this.deselectNode(node);
        } else {
          this.selectNode(node, true);
        }
      } else {
        if (!node.isSelected) {
          this.selectNode(node, false);
        }
      }

      // Start dragging if on header and node is selected
      if (node.isPointInHeader(pos.x, pos.y) && node.isSelected) {
        this.draggedNode = node;
        node.isDragging = true;
        node.dragOffsetX = pos.x - node.x;
        node.dragOffsetY = pos.y - node.y;

        // Store drag offsets for all selected nodes
        this.selectedNodes.forEach((selectedNode) => {
          selectedNode.dragOffsetX = pos.x - selectedNode.x;
          selectedNode.dragOffsetY = pos.y - selectedNode.y;
        });

        // Store initial positions for all selected reroute nodes
        this.selectedRerouteNodes.forEach((rn) => {
          rn.dragOffsetX = pos.x - rn.x;
          rn.dragOffsetY = pos.y - rn.y;
        });

        // Move to front
        this.nodes = this.nodes.filter((n) => n !== node);
        this.nodes.push(node);
      }

      this.render();
      return;
    }

    // Start box selection if clicking on empty space
    if (!isMultiSelect) {
      this.clearSelection();
    }
    this.isBoxSelecting = true;
    this.boxSelectStart = { x: pos.x, y: pos.y };
    this.boxSelectEnd = { x: pos.x, y: pos.y };
    this.render();
  }

  onMouseMove(e) {
    // Handle panning
    if (this.isPanning) {
      const rect = this.canvas.getBoundingClientRect();
      this.camera.x = e.clientX - rect.left - this.panStart.x;
      this.camera.y = e.clientY - rect.top - this.panStart.y;
      this.render();
      return;
    }

    const pos = this.getMousePos(e);

    // Update hovered port
    this.hoveredPort = this.findPortAtPosition(pos.x, pos.y);

    // Box selection
    if (this.isBoxSelecting) {
      this.boxSelectEnd = { x: pos.x, y: pos.y };

      // Update selection based on box
      const minX = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
      const maxX = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
      const minY = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
      const maxY = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);

      // Select nodes within box
      this.nodes.forEach((node) => {
        const inBox =
          node.x < maxX &&
          node.x + node.width > minX &&
          node.y < maxY &&
          node.y + node.height > minY;

        if (inBox && !node.isSelected) {
          this.selectNode(node, true);
        } else if (!inBox && node.isSelected && !this.selectedNodes.has(node)) {
          // Only deselect if it wasn't previously selected before box selection
          this.deselectNode(node);
        }
      });

      // Select reroute nodes within box
      this.wires.forEach((wire) => {
        wire.rerouteNodes.forEach((rn) => {
          const inBox =
            rn.x >= minX && rn.x <= maxX && rn.y >= minY && rn.y <= maxY;

          if (inBox && !rn.isSelected) {
            this.selectRerouteNode(rn, true);
          } else if (
            !inBox &&
            rn.isSelected &&
            !this.selectedRerouteNodes.has(rn)
          ) {
            this.deselectRerouteNode(rn);
          }
        });
      });

      this.render();
      return;
    }

    // Drag reroute nodes (including all selected ones and nodes)
    if (this.draggedRerouteNode) {
      const deltaX = pos.x - this.draggedRerouteNode.x;
      const deltaY = pos.y - this.draggedRerouteNode.y;

      // Move all selected reroute nodes
      this.selectedRerouteNodes.forEach((rn) => {
        rn.x += deltaX;
        rn.y += deltaY;
      });

      // Move all selected nodes
      this.selectedNodes.forEach((node) => {
        node.x = pos.x - node.dragOffsetX;
        node.y = pos.y - node.dragOffsetY;
      });

      this.render();
      return;
    }

    // Drag nodes (including all selected ones and reroute nodes)
    if (this.draggedNode) {
      // Move all selected nodes together
      this.selectedNodes.forEach((node) => {
        node.x = pos.x - node.dragOffsetX;
        node.y = pos.y - node.dragOffsetY;
      });

      // Move all selected reroute nodes
      this.selectedRerouteNodes.forEach((rn) => {
        rn.x = pos.x - rn.dragOffsetX;
        rn.y = pos.y - rn.dragOffsetY;
      });

      this.render();
      return;
    }

    // Drag wire
    if (this.activeWire) {
      this.activeWire.tempEndX = pos.x;
      this.activeWire.tempEndY = pos.y;
      this.render();
      return;
    }

    // Update cursor
    const rerouteNode = this.findRerouteNodeAtPosition(pos.x, pos.y);
    if (rerouteNode) {
      this.canvas.style.cursor = "move";
    } else if (this.hoveredPort) {
      this.canvas.style.cursor = "pointer";
    } else {
      // Check if hovering over a value box
      let overValueBox = false;
      for (const node of this.nodes) {
        for (const port of node.inputPorts) {
          if (
            port.isEditable &&
            port.connections.length === 0 &&
            port.isPointInValueBox(pos.x, pos.y, this.ctx)
          ) {
            overValueBox = true;
            break;
          }
        }
        if (overValueBox) break;
      }

      if (overValueBox) {
        this.canvas.style.cursor = "text";
      } else {
        const node = this.findNodeAtPosition(pos.x, pos.y);
        if (node && node.isPointInHeader(pos.x, pos.y)) {
          this.canvas.style.cursor = "move";
        } else {
          this.canvas.style.cursor = "default";
        }
      }
    }

    this.render();
  }

  onMouseUp(e) {
    // Stop panning
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      return;
    }

    const pos = this.getMousePos(e);

    // Complete wire connection
    if (this.activeWire) {
      const port = this.findPortAtPosition(pos.x, pos.y);

      // Handle reversed wire (started from input)
      if (this.activeWire.isReversed) {
        if (
          port &&
          port.type === "output" &&
          port.canConnectTo(this.activeWire.startPort)
        ) {
          // Reverse the wire: swap start and end
          const inputPort = this.activeWire.startPort;
          this.activeWire.startPort = port;
          this.activeWire.endPort = inputPort;
          delete this.activeWire.isReversed;

          // Add to wires if not already there
          if (!this.wires.includes(this.activeWire)) {
            this.wires.push(this.activeWire);
          }
          port.connections.push(this.activeWire);
          inputPort.connections.push(this.activeWire);

          // Resolve generic types
          this.resolveGenericsForConnection(port, inputPort);

          this.activeWire = null;
          this.onShaderChanged();
        } else {
          // Remove the wire if it was picked up
          if (this.wires.includes(this.activeWire)) {
            this.disconnectWire(this.activeWire);
            this.onShaderChanged();
          }

          // Only show search menu if wire wasn't picked up
          if (!this.activeWire.wasPickedUp) {
            const startPort = this.activeWire.startPort;
            const filterType = "input"; // We're dragging from an input, need nodes with outputs

            // Show search menu with filter
            this.showSearchMenu(e.clientX, e.clientY, startPort, filterType);
            // Don't set activeWire to null yet - it will be used in selectNodeType
            return;
          }

          this.activeWire = null;
        }
      }
      // Normal wire (started from output)
      else {
        if (
          port &&
          port.type === "input" &&
          this.activeWire.startPort.canConnectTo(port)
        ) {
          // Remove any existing connection on the input port
          if (port.connections.length > 0) {
            const oldWire = port.connections[0];
            this.disconnectWire(oldWire);
          }

          // Valid connection
          this.activeWire.endPort = port;
          if (!this.wires.includes(this.activeWire)) {
            this.wires.push(this.activeWire);
          }
          port.connections.push(this.activeWire);
          this.activeWire.startPort.connections.push(this.activeWire);

          // Resolve generic types
          this.resolveGenericsForConnection(this.activeWire.startPort, port);

          this.activeWire = null;
          this.onShaderChanged();
        } else {
          // Remove the wire if it was picked up
          if (this.wires.includes(this.activeWire)) {
            this.disconnectWire(this.activeWire);
          }

          // Only show search menu if wire wasn't picked up
          if (!this.activeWire.wasPickedUp) {
            const startPort = this.activeWire.startPort;
            const filterType = "output"; // We're dragging from an output, need nodes with inputs

            // Show search menu with filter
            this.showSearchMenu(e.clientX, e.clientY, startPort, filterType);
            // Don't set activeWire to null yet - it will be used in selectNodeType
            return;
          }

          this.activeWire = null;
        }
      }
    }

    // Stop box selection
    if (this.isBoxSelecting) {
      this.isBoxSelecting = false;
      this.boxSelectStart = null;
      this.boxSelectEnd = null;
    }

    // Stop dragging reroute node
    if (this.draggedRerouteNode) {
      this.draggedRerouteNode.isDragging = false;
      this.draggedRerouteNode = null;
    }

    // Stop dragging node
    if (this.draggedNode) {
      this.draggedNode.isDragging = false;
      this.draggedNode = null;
    }

    this.render();
  }

  onContextMenu(e) {
    e.preventDefault(); // Prevent default context menu
    const pos = this.getMousePos(e);

    // Check if right-clicking on a reroute node
    const rerouteNode = this.findRerouteNodeAtPosition(pos.x, pos.y);
    if (rerouteNode) {
      // Delete the reroute node
      rerouteNode.wire.removeRerouteNode(rerouteNode);
      this.render();
      return;
    }

    // Show search menu at cursor position
    this.showSearchMenu(e.clientX, e.clientY);
  }

  drawGrid() {
    const ctx = this.ctx;
    const gridSize = 20;

    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1 / this.camera.zoom;

    // Calculate visible world bounds
    const startX =
      Math.floor(-this.camera.x / this.camera.zoom / gridSize) * gridSize;
    const startY =
      Math.floor(-this.camera.y / this.camera.zoom / gridSize) * gridSize;
    const endX =
      startX + Math.ceil(this.canvas.width / this.camera.zoom) + gridSize;
    const endY =
      startY + Math.ceil(this.canvas.height / this.camera.zoom) + gridSize;

    // Vertical lines
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  drawWire(wire) {
    const ctx = this.ctx;
    const points = wire.getPoints();

    if (points.length < 2) return;

    // Use the color of the output port (start port)
    const wireColor = wire.startPort.getColor();
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 3;

    // Draw wire segments with bezier curves
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const dx = Math.abs(end.x - start.x);
      const offset = Math.min(dx * 0.5, 100);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(
        start.x + offset,
        start.y,
        end.x - offset,
        end.y,
        end.x,
        end.y
      );
      ctx.stroke();
    }

    // Draw reroute nodes
    wire.rerouteNodes.forEach((rerouteNode) => {
      ctx.fillStyle =
        rerouteNode.isDragging || rerouteNode.isSelected
          ? "#6ab0ff"
          : wireColor;
      ctx.strokeStyle =
        rerouteNode.isDragging || rerouteNode.isSelected
          ? "#6ab0ff"
          : "#2d2d2d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rerouteNode.x, rerouteNode.y, rerouteNode.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  drawPort(port) {
    const ctx = this.ctx;
    const pos = port.getPosition();
    const isHovered = this.hoveredPort === port;
    const portColor = port.getColor();

    // Port circle
    ctx.fillStyle = port.connections.length > 0 ? portColor : "#2d2d2d";
    ctx.strokeStyle = isHovered ? "#ffffff" : portColor;
    ctx.lineWidth = isHovered ? 3 : 2;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, port.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Port label
    ctx.fillStyle = "#aaa";
    ctx.font = "12px sans-serif";
    const label = port.name;

    if (port.type === "input") {
      ctx.textAlign = "left";

      // Draw label
      ctx.fillText(label, pos.x + 15, pos.y + 4);

      // Draw value box for editable ports with no connections
      if (
        port.isEditable &&
        port.connections.length === 0 &&
        this.editingPort !== port
      ) {
        const bounds = port.getValueBoxBounds(ctx);
        const resolvedType = port.getResolvedType();
        let valueStr;

        if (resolvedType === "float") {
          valueStr = port.value.toFixed(2);
        } else if (resolvedType === "vec2") {
          // Show vec2 as two boxes side by side
          const values = [port.value[0].toFixed(1), port.value[1].toFixed(1)];
          const boxWidth = 35;
          const boxHeight = 20;
          const gap = 1;

          values.forEach((value, i) => {
            const boxX = bounds.x + i * (boxWidth + gap);
            const boxY = bounds.y;

            // Draw value box background
            ctx.fillStyle = "#1a1a1a";
            ctx.strokeStyle = "#4a4a4a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
            ctx.fill();
            ctx.stroke();

            // Draw value text
            ctx.fillStyle = "#ffffff";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.fillText(value, boxX + boxWidth / 2, boxY + boxHeight / 2 + 4);
          });

          valueStr = null; // Already drawn
        } else if (resolvedType === "vec3") {
          // Check if all values are in 0-1 range
          const inRange = port.value.every((v) => v >= 0 && v <= 1);

          if (inRange) {
            // Show as color swatch
            const r = Math.round(port.value[0] * 255);
            const g = Math.round(port.value[1] * 255);
            const b = Math.round(port.value[2] * 255);

            // Draw color swatch
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.strokeStyle = "#4a4a4a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 3);
            ctx.fill();
            ctx.stroke();

            // Skip text rendering for vec3
            valueStr = null;
          } else {
            // Show raw values as 2x2 grid (3 values: top-left, top-right, bottom-left)
            const values = [
              port.value[0].toFixed(1),
              port.value[1].toFixed(1),
              port.value[2].toFixed(1),
            ];
            const boxWidth = 35;
            const boxHeight = 20;
            const gap = 1;

            // Draw first two values in top row
            for (let i = 0; i < 2; i++) {
              const boxX = bounds.x + i * (boxWidth + gap);
              const boxY = bounds.y;

              // Draw value box background
              ctx.fillStyle = "#1a1a1a";
              ctx.strokeStyle = "#4a4a4a";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
              ctx.fill();
              ctx.stroke();

              // Draw value text
              ctx.fillStyle = "#ffffff";
              ctx.font = "12px monospace";
              ctx.textAlign = "center";
              ctx.fillText(
                values[i],
                boxX + boxWidth / 2,
                boxY + boxHeight / 2 + 4
              );
            }

            // Draw third value in bottom-left
            const boxX = bounds.x;
            const boxY = bounds.y + boxHeight + gap;

            ctx.fillStyle = "#1a1a1a";
            ctx.strokeStyle = "#4a4a4a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.fillText(
              values[2],
              boxX + boxWidth / 2,
              boxY + boxHeight / 2 + 4
            );

            valueStr = null; // Already drawn
          }
        } else if (resolvedType === "vec4") {
          // Check if all values are in 0-1 range
          const inRange = port.value.every((v) => v >= 0 && v <= 1);

          if (inRange) {
            // Show as color swatch with alpha
            const r = Math.round(port.value[0] * 255);
            const g = Math.round(port.value[1] * 255);
            const b = Math.round(port.value[2] * 255);
            const a = port.value[3];

            // Draw checkerboard pattern for transparency
            const checkSize = 4;
            for (let x = 0; x < bounds.width; x += checkSize) {
              for (let y = 0; y < bounds.height; y += checkSize) {
                const isEven =
                  (Math.floor(x / checkSize) + Math.floor(y / checkSize)) %
                    2 ===
                  0;
                ctx.fillStyle = isEven ? "#888" : "#666";
                ctx.fillRect(bounds.x + x, bounds.y + y, checkSize, checkSize);
              }
            }

            // Draw color with alpha
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            ctx.beginPath();
            ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 3);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = "#4a4a4a";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Skip text rendering for vec4
            valueStr = null;
          } else {
            // Show raw values as 2x2 grid
            const values = [
              port.value[0].toFixed(1),
              port.value[1].toFixed(1),
              port.value[2].toFixed(1),
              port.value[3].toFixed(1),
            ];
            const boxWidth = 35;
            const boxHeight = 20;
            const gap = 1;

            // Draw 2x2 grid
            for (let row = 0; row < 2; row++) {
              for (let col = 0; col < 2; col++) {
                const index = row * 2 + col;
                const boxX = bounds.x + col * (boxWidth + gap);
                const boxY = bounds.y + row * (boxHeight + gap);

                // Draw value box background
                ctx.fillStyle = "#1a1a1a";
                ctx.strokeStyle = "#4a4a4a";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
                ctx.fill();
                ctx.stroke();

                // Draw value text
                ctx.fillStyle = "#ffffff";
                ctx.font = "12px monospace";
                ctx.textAlign = "center";
                ctx.fillText(
                  values[index],
                  boxX + boxWidth / 2,
                  boxY + boxHeight / 2 + 4
                );
              }
            }

            valueStr = null; // Already drawn
          }
        } else {
          valueStr = port.value.toString();
        }

        // Draw value box background and text for non-color types (float, int, boolean)
        if (valueStr !== null) {
          ctx.fillStyle = "#1a1a1a";
          ctx.strokeStyle = "#4a4a4a";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 3);
          ctx.fill();
          ctx.stroke();

          // Draw value text
          ctx.fillStyle = "#ffffff";
          ctx.font = "11px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            valueStr,
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2 + 4
          );
        }
      }
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, pos.x - 15, pos.y + 4);
    }

    // Draw tooltip for hovered port
    if (isHovered) {
      // Show tooltip if: no connections OR is a generic/custom type
      const shouldShowTooltip =
        port.connections.length === 0 ||
        isGenericType(port.portType) ||
        port.portType === "custom";

      if (shouldShowTooltip) {
        let tooltipText;

        if (port.portType === "custom") {
          // Custom type - show resolved type
          const resolvedType = port.getResolvedType();
          const resolvedName = PORT_TYPES[resolvedType]?.name || resolvedType;
          tooltipText = resolvedName;
        } else if (isGenericType(port.portType)) {
          const resolvedType = port.getResolvedType();
          const genericName = PORT_TYPES[port.portType]?.name || port.portType;

          if (resolvedType !== port.portType) {
            // Generic is resolved - show both
            const resolvedName = PORT_TYPES[resolvedType]?.name || resolvedType;
            tooltipText = `${genericName} (${resolvedName})`;
          } else {
            // Generic is unresolved
            tooltipText = genericName;
          }
        } else {
          // Regular type
          const typeName = PORT_TYPES[port.portType]?.name || port.portType;
          tooltipText = typeName;
        }

        // Measure text for tooltip background
        ctx.font = "11px sans-serif";
        const textWidth = ctx.measureText(tooltipText).width;
        const padding = 6;
        const tooltipWidth = textWidth + padding * 2;
        const tooltipHeight = 18;

        // Position tooltip above the port
        const tooltipX = pos.x - tooltipWidth / 2;
        const tooltipY = pos.y - port.radius - tooltipHeight - 5;

        // Draw tooltip background
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.strokeStyle = portColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 3);
        ctx.fill();
        ctx.stroke();

        // Draw tooltip text
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(tooltipText, pos.x, tooltipY + 13);
      }
    }
  }

  drawNode(node) {
    const ctx = this.ctx;

    // Shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    if (node.isVariable) {
      // Variable nodes are pill-shaped with gradient
      const gradient = ctx.createLinearGradient(
        node.x,
        node.y,
        node.x + node.width,
        node.y + node.height
      );

      // Create gradient from the base color
      const baseColor = node.headerColor;
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, this.adjustBrightness(baseColor, -20));

      ctx.fillStyle = gradient;
      ctx.strokeStyle =
        node.isDragging || node.isSelected
          ? "#6ab0ff"
          : this.adjustBrightness(baseColor, -30);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, node.height / 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Title
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";

      // For uniform nodes, show both names if they differ
      if (
        node.uniformDisplayName &&
        node.uniformVariableName &&
        node.uniformDisplayName !== node.uniformVariableName
      ) {
        // Display name
        ctx.fillText(
          node.uniformDisplayName,
          node.x + node.width / 2,
          node.y + node.height / 2 - 2
        );

        // Variable name (smaller, gray)
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.fillText(
          `(${node.uniformVariableName})`,
          node.x + node.width / 2,
          node.y + node.height / 2 + 10
        );
      } else {
        // Single title
        ctx.fillText(
          node.title,
          node.x + node.width / 2,
          node.y + node.height / 2 + 4
        );
      }

      // Draw output port (no label for variable nodes)
      node.outputPorts.forEach((port) => {
        const pos = port.getPosition();
        const portColor = port.getColor();

        // Port circle
        ctx.fillStyle = port.connections.length > 0 ? portColor : "#2d2d2d";
        ctx.strokeStyle = this.hoveredPort === port ? "#ffffff" : portColor;
        ctx.lineWidth = this.hoveredPort === port ? 3 : 2;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, port.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else {
      // Regular nodes
      // Node body
      ctx.fillStyle = "#2d2d2d";
      ctx.strokeStyle =
        node.isDragging || node.isSelected ? "#6ab0ff" : "#4a4a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Header
      ctx.fillStyle = node.headerColor;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, 35, [8, 8, 0, 0]);
      ctx.fill();

      // Title
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.title, node.x + node.width / 2, node.y + 22);

      // Operation dropdown (if node has operations)
      if (node.nodeType.hasOperation) {
        const dropdown = node.getOperationDropdownBounds();

        // Dropdown background
        ctx.fillStyle = "#1a1a1a";
        ctx.strokeStyle = "#4a4a4a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
          dropdown.x,
          dropdown.y,
          dropdown.width,
          dropdown.height,
          4
        );
        ctx.fill();
        ctx.stroke();

        // Get the label for the current operation
        const currentOp = node.nodeType.operationOptions.find(
          (op) => op.value === node.operation
        );
        const displayText = currentOp
          ? currentOp.label
          : node.nodeType.operationOptions[0].label;

        // Dropdown text
        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          displayText,
          dropdown.x + dropdown.width / 2,
          dropdown.y + dropdown.height / 2 + 5
        );

        // Dropdown arrow
        ctx.fillStyle = "#888";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(
          "▼",
          dropdown.x + dropdown.width - 5,
          dropdown.y + dropdown.height / 2 + 3
        );
      }

      // Custom input field (if node has custom input)
      if (node.nodeType.hasCustomInput) {
        const inputBounds = node.getCustomInputBounds();

        // Input background
        ctx.fillStyle = "#1a1a1a";
        ctx.strokeStyle =
          this.editingCustomInput === node ? "#6ab0ff" : "#4a4a4a";
        ctx.lineWidth = this.editingCustomInput === node ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(
          inputBounds.x,
          inputBounds.y,
          inputBounds.width,
          inputBounds.height,
          4
        );
        ctx.fill();
        ctx.stroke();

        // Input text
        ctx.fillStyle = "#fff";
        ctx.font = "14px monospace";
        ctx.textAlign = "left";
        const displayValue =
          node.customInput || node.nodeType.customInputConfig.placeholder;
        const textX = inputBounds.x + 8;
        const textY = inputBounds.y + inputBounds.height / 2 + 5;

        // Clip text to input bounds
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          inputBounds.x,
          inputBounds.y,
          inputBounds.width,
          inputBounds.height
        );
        ctx.clip();
        ctx.fillText(displayValue, textX, textY);
        ctx.restore();

        // Show label if available
        if (node.nodeType.customInputConfig.label) {
          ctx.fillStyle = "#888";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(
            node.nodeType.customInputConfig.label,
            inputBounds.x,
            inputBounds.y - 3
          );
        }
      }

      // Ports
      node.inputPorts.forEach((port) => this.drawPort(port));
      node.outputPorts.forEach((port) => this.drawPort(port));
    }
  }

  adjustBrightness(color, amount) {
    // Convert hex to RGB
    const hex = color.replace("#", "");
    const r = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(0, 2), 16) + amount)
    );
    const g = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(2, 2), 16) + amount)
    );
    const b = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(4, 2), 16) + amount)
    );

    // Convert back to hex
    return (
      "#" +
      r.toString(16).padStart(2, "0") +
      g.toString(16).padStart(2, "0") +
      b.toString(16).padStart(2, "0")
    );
  }

  render() {
    const ctx = this.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context and apply camera transform
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Draw grid
    this.drawGrid();

    // Draw wires
    this.wires.forEach((wire) => this.drawWire(wire));

    // Draw active wire being created
    if (this.activeWire) {
      this.drawWire(this.activeWire);
    }

    // Draw nodes
    this.nodes.forEach((node) => this.drawNode(node));

    // Draw box selection
    if (this.isBoxSelecting && this.boxSelectStart && this.boxSelectEnd) {
      ctx.strokeStyle = "#4a90e2";
      ctx.fillStyle = "rgba(74, 144, 226, 0.1)";
      ctx.lineWidth = 2 / this.camera.zoom;
      ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);

      const x = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
      const y = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
      const width = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
      const height = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);

      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }

    // Restore context
    ctx.restore();
  }
}

// Initialize the system
const canvas = document.getElementById("canvas");
const blueprint = new BlueprintSystem(canvas);

// Add default output node
blueprint.addNode(600, 300, NODE_TYPES.output);
