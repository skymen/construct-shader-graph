// Blueprint Node System
import { NODE_TYPES, PORT_TYPES, areTypesCompatible } from "./nodes/index.js";
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
    const portTypeInfo = PORT_TYPES[this.portType];
    if (type === "input" && portTypeInfo?.editable) {
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
    const spacing = 40;
    const startY = node.y + 50;
    const y = startY + this.index * spacing;
    return { x, y };
  }

  getValueBoxBounds(ctx) {
    if (!this.isEditable || this.type !== "input") return null;
    const pos = this.getPosition();
    const width = 50;
    const height = 20;

    // Measure the actual label width
    let labelWidth = 30; // Default fallback
    if (ctx) {
      ctx.save();
      ctx.font = "12px sans-serif";
      labelWidth = ctx.measureText(this.name).width + 5; // Add small padding
      ctx.restore();
    }

    return {
      x: pos.x + 15 + labelWidth,
      y: pos.y - height / 2,
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

  getColor() {
    return PORT_TYPES[this.portType]?.color || PORT_TYPES.any.color;
  }

  canConnectTo(otherPort) {
    // Can't connect to same type (input to input, output to output)
    if (this.type === otherPort.type) return false;
    // Can't connect to same node
    if (this.node === otherPort.node) return false;

    // Determine which is output and which is input
    const outputPort = this.type === "output" ? this : otherPort;
    const inputPort = this.type === "input" ? this : otherPort;

    // Check type compatibility using the new system
    return areTypesCompatible(outputPort.portType, inputPort.portType);
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
      // Calculate height based on number of ports
      const maxPorts = Math.max(
        this.inputPorts.length,
        this.outputPorts.length
      );
      this.height = 50 + maxPorts * 40 + 10;
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

    this.setupCanvas();
    // Uniforms
    this.uniforms = [];
    this.uniformIdCounter = 1;

    this.setupEventListeners();
    this.setupInputField();
    this.setupSearchMenu();
    this.setupUniformSidebar();
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

  setupUniformSidebar() {
    this.uniformModal = document.getElementById("uniformModal");
    this.uniformNameInput = document.getElementById("uniformNameInput");
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
  }

  showUniformModal() {
    this.uniformNameInput.value = "";
    this.uniformTypeSelect.value = "float";
    this.uniformModal.classList.add("visible");
    setTimeout(() => this.uniformNameInput.focus(), 0);
  }

  hideUniformModal() {
    this.uniformModal.classList.remove("visible");
  }

  addUniform() {
    const name = this.uniformNameInput.value.trim();
    const type = this.uniformTypeSelect.value;

    if (!name) {
      alert("Please enter a uniform name");
      return;
    }

    // Check for duplicate names
    if (this.uniforms.some((u) => u.name === name)) {
      alert("A uniform with this name already exists");
      return;
    }

    const uniform = {
      id: this.uniformIdCounter++,
      name: name,
      type: type, // 'float', 'percent', or 'color'
      value:
        type === "color"
          ? { r: 1, g: 1, b: 1 }
          : type === "percent"
          ? 0.5
          : 0.0,
    };

    this.uniforms.push(uniform);
    this.hideUniformModal();
    this.renderUniformList();
  }

  deleteUniform(id) {
    this.uniforms = this.uniforms.filter((u) => u.id !== id);
    this.renderUniformList();
  }

  updateUniformValue(id, value) {
    const uniform = this.uniforms.find((u) => u.id === id);
    if (uniform) {
      uniform.value = value;
    }
  }

  renderUniformList() {
    this.uniformList.innerHTML = "";

    this.uniforms.forEach((uniform) => {
      const item = document.createElement("div");
      item.className = "uniform-item";

      const header = document.createElement("div");
      header.className = "uniform-item-header";

      const nameSpan = document.createElement("span");
      nameSpan.className = "uniform-item-name";
      nameSpan.textContent = uniform.name;

      const typeSpan = document.createElement("span");
      typeSpan.className = "uniform-item-type";
      typeSpan.textContent =
        uniform.type === "percent"
          ? "Percent (Float)"
          : uniform.type === "color"
          ? "Color (Vec3)"
          : "Float";

      const controls = document.createElement("div");
      controls.className = "uniform-item-controls";

      const createNodeBtn = document.createElement("button");
      createNodeBtn.className = "uniform-delete-btn";
      createNodeBtn.style.background = "#4a90e2";
      createNodeBtn.textContent = "Create Node";
      createNodeBtn.addEventListener("click", () =>
        this.createUniformNode(uniform)
      );

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "uniform-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => this.deleteUniform(uniform.id));

      controls.appendChild(createNodeBtn);
      controls.appendChild(deleteBtn);
      header.appendChild(nameSpan);
      header.appendChild(typeSpan);
      header.appendChild(controls);

      item.appendChild(header);

      // Value control
      const valueControl = document.createElement("div");
      valueControl.className = "uniform-value-control";

      if (uniform.type === "float") {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.01";
        input.value = uniform.value;
        input.addEventListener("input", (e) => {
          this.updateUniformValue(uniform.id, parseFloat(e.target.value) || 0);
        });
        valueControl.appendChild(input);
      } else if (uniform.type === "percent") {
        const percentDisplay = document.createElement("div");
        percentDisplay.className = "uniform-percent-display";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = uniform.value;

        const percentText = document.createElement("span");
        percentText.textContent = `${Math.round(uniform.value * 100)}%`;

        slider.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value);
          this.updateUniformValue(uniform.id, val);
          percentText.textContent = `${Math.round(val * 100)}%`;
        });

        percentDisplay.appendChild(slider);
        percentDisplay.appendChild(percentText);
        valueControl.appendChild(percentDisplay);
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
        valueControl.appendChild(colorInput);
      }

      item.appendChild(valueControl);
      this.uniformList.appendChild(item);
    });
  }

  createUniformNode(uniform) {
    // Determine node type based on uniform type
    let nodeType;
    if (uniform.type === "color") {
      nodeType = UniformColorNode;
    } else {
      // Both 'float' and 'percent' use UniformFloatNode
      nodeType = UniformFloatNode;
    }

    // Create node at center of viewport
    const centerX = (-this.camera.x + this.canvas.width / 2) / this.camera.zoom;
    const centerY =
      (-this.camera.y + this.canvas.height / 2) / this.camera.zoom;

    const node = new Node(centerX, centerY, this.nodeIdCounter++, nodeType);
    node.uniformName = uniform.name;
    node.uniformId = uniform.id;

    // Update node title to show uniform name
    node.nodeType = {
      ...nodeType,
      name: `Uniform: ${uniform.name}`,
    };

    this.nodes.push(node);
    this.render();
  }

  startEditingPort(port) {
    if (!port.isEditable || port.connections.length > 0) return;

    // For boolean types, just toggle the value directly
    if (port.portType === "boolean") {
      port.value = !port.value;
      this.render();
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

    this.inputField.value = port.value.toString();
    this.inputField.style.left = `${rect.left + window.scrollX + screenX}px`;
    this.inputField.style.top = `${rect.top + window.scrollY + screenY}px`;
    this.inputField.style.width = `${screenWidth}px`;
    this.inputField.style.height = `${screenHeight}px`;
    this.inputField.style.display = "block";
    this.inputField.style.visibility = "visible";
    this.inputField.style.opacity = "1";
    this.inputField.style.pointerEvents = "auto";

    // Use setTimeout to ensure the input is rendered before focusing
    setTimeout(() => {
      this.inputField.focus();
      this.inputField.select();
    }, 0);
  }

  finishEditingPort() {
    if (!this.editingPort) return;

    const value = this.inputField.value;
    if (this.editingPort.portType === "int") {
      const intValue = parseInt(value);
      if (!isNaN(intValue)) {
        this.editingPort.value = intValue;
      }
    } else if (this.editingPort.portType === "float") {
      const floatValue = parseFloat(value);
      if (!isNaN(floatValue)) {
        this.editingPort.value = floatValue;
      }
    }

    this.hideInputField();
    this.render();
  }

  cancelEditingPort() {
    this.hideInputField();
  }

  hideInputField() {
    this.inputField.style.display = "none";
    this.inputField.style.visibility = "hidden";
    this.inputField.style.opacity = "0";
    this.inputField.style.pointerEvents = "none";
    this.editingPort = null;
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

  getFilteredNodeTypes() {
    let nodeTypes = Object.entries(NODE_TYPES);

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
      const portType = this.searchFilterPort.portType;

      nodeTypes = nodeTypes.filter(([key, nodeType]) => {
        if (this.searchFilterType === "input") {
          // Dragging from an input port - show nodes with compatible output ports
          return nodeType.outputs.some(
            (output) =>
              output.type === portType ||
              output.type === "any" ||
              portType === "any"
          );
        } else {
          // Dragging from an output port - show nodes with compatible input ports
          return nodeType.inputs.some(
            (input) =>
              input.type === portType ||
              input.type === "any" ||
              portType === "any"
          );
        }
      });
    }

    return nodeTypes;
  }

  updateSearchResults() {
    const query = this.searchInput.value.toLowerCase();
    const filteredTypes = this.getFilteredNodeTypes();

    // Filter by search query
    const results = filteredTypes.filter(([key, nodeType]) => {
      return nodeType.name.toLowerCase().includes(query);
    });

    // Clear results
    this.searchResults.innerHTML = "";

    // Add results
    results.forEach(([key, nodeType]) => {
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

      this.searchResults.appendChild(item);
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

    const newNode = this.addNode(worldX, worldY, nodeType);

    // If we were dragging a wire, connect it to the new node
    if (this.searchFilterPort) {
      if (this.searchFilterType === "input") {
        // We were dragging from an input port
        // Connect to a compatible output port on the new node
        const compatibleOutput = newNode.outputPorts.find(
          (port) =>
            port.portType === this.searchFilterPort.portType ||
            port.portType === "any" ||
            this.searchFilterPort.portType === "any"
        );
        if (compatibleOutput) {
          // Create a new wire from the output to the input
          const wire = new Wire(compatibleOutput, this.searchFilterPort);
          this.wires.push(wire);
          compatibleOutput.connections.push(wire);
          this.searchFilterPort.connections.push(wire);
        }
      } else {
        // We were dragging from an output port
        // Connect to a compatible input port on the new node
        const compatibleInput = newNode.inputPorts.find(
          (port) =>
            port.portType === this.searchFilterPort.portType ||
            port.portType === "any" ||
            this.searchFilterPort.portType === "any"
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
        }
      }
    }

    // Clear active wire
    this.activeWire = null;

    this.hideSearchMenu();
    this.render();
    this.updateDependencyList();
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

    // Keyboard events
    document.addEventListener("keydown", (e) => this.onKeyDown(e));

    document.getElementById("clearBtn").addEventListener("click", () => {
      this.nodes = [];
      this.wires = [];
      this.selectedNodes.clear();
      this.selectedRerouteNodes.clear();
      // Re-add the output node
      this.addNode(600, 300, NODE_TYPES.output);
      this.render();
      this.updateDependencyList();
    });

    document.getElementById("closeSidebarBtn").addEventListener("click", () => {
      this.closeSidebar();
    });

    document.getElementById("exportBtn").addEventListener("click", () => {
      this.exportGLSL();
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

    if (e.key === "Delete" || e.key === "Backspace") {
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

  generateVariableNames(levels) {
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
            if (port.isEditable) {
              const value =
                port.portType === "float"
                  ? port.value.toFixed(2)
                  : port.value.toString();
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

    let declarations = "\n// Uniforms\n";

    if (target === "webgpu") {
      // WebGPU uses a uniform block
      declarations += "struct Uniforms {\n";
      this.uniforms.forEach((uniform) => {
        if (uniform.type === "color") {
          declarations += `  ${uniform.name}: vec3<f32>,\n`;
        } else {
          // float and percent are both float
          declarations += `  ${uniform.name}: f32,\n`;
        }
      });
      declarations += "}\n";
      declarations +=
        "@group(0) @binding(0) var<uniform> uniforms: Uniforms;\n\n";
    } else {
      // WebGL 1 and 2 use individual uniform declarations
      this.uniforms.forEach((uniform) => {
        if (uniform.type === "color") {
          declarations += `uniform vec3 ${uniform.name};\n`;
        } else {
          declarations += `uniform float ${uniform.name};\n`;
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
        const dep = node.nodeType.getDependency(target);
        if (dep) {
          dependencies.add(dep);
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
        const execution = node.nodeType.getExecution(target);
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
    const portToVarName = this.generateVariableNames(levels);

    // Create ZIP file
    const zip = new JSZip();

    // Generate shaders for all targets
    const targets = ["webgl1", "webgl2", "webgpu"];

    for (const target of targets) {
      const boilerplate = this.getBoilerplate(target);
      const uniformDeclarations = this.generateUniformDeclarations(target);
      const shaderCode = this.generateShader(target, levels, portToVarName);
      const fullShader = boilerplate + uniformDeclarations + shaderCode;

      const extension = target === "webgpu" ? "wgsl" : "frag";
      const filename = `shader-${target}.${extension}`;

      zip.file(filename, fullShader);

      // Also log to console
      console.log(`Generated ${target.toUpperCase()} Shader:`);
      console.log(fullShader);
      console.log("---");
    }

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shaders.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    }
    if (wire.endPort) {
      const index = wire.endPort.connections.indexOf(wire);
      if (index > -1) wire.endPort.connections.splice(index, 1);
    }
    // Remove from wires array
    const wireIndex = this.wires.indexOf(wire);
    if (wireIndex > -1) this.wires.splice(wireIndex, 1);
  }

  onMouseDown(e) {
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
          this.activeWire = null;
        } else {
          // Remove the wire if it was picked up
          if (this.wires.includes(this.activeWire)) {
            this.disconnectWire(this.activeWire);
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
          this.activeWire = null;
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
        const valueStr =
          port.portType === "float"
            ? port.value.toFixed(2)
            : port.value.toString();

        // Draw value box background
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
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, pos.x - 15, pos.y + 4);
    }

    // Draw tooltip for hovered port with no connections
    if (isHovered && port.connections.length === 0 && !port.isEditable) {
      const typeName = PORT_TYPES[port.portType]?.name || port.portType;
      const tooltipText = typeName;

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
      ctx.fillText(
        node.title,
        node.x + node.width / 2,
        node.y + node.height / 2 + 4
      );

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
