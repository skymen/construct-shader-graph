// Blueprint Node System

// Port type definitions with colors
const PORT_TYPES = {
  float: { color: "#4a90e2", name: "Float" },
  vector: { color: "#e2a44a", name: "Vector" },
  color: { color: "#e24a90", name: "Color" },
  texture: { color: "#90e24a", name: "Texture" },
  any: { color: "#888888", name: "Any" },
};

// Node type definitions
class NodeType {
  constructor(name, inputs, outputs, color = "#3a3a3a") {
    this.name = name;
    this.inputs = inputs; // Array of {name, type}
    this.outputs = outputs; // Array of {name, type}
    this.color = color;
  }
}

// Define available node types
const NODE_TYPES = {
  math: new NodeType(
    "Math",
    [
      { name: "A", type: "float" },
      { name: "B", type: "float" },
    ],
    [{ name: "Result", type: "float" }],
    "#3a4a3a"
  ),
  vector: new NodeType(
    "Vector",
    [
      { name: "X", type: "float" },
      { name: "Y", type: "float" },
      { name: "Z", type: "float" },
    ],
    [{ name: "Vector", type: "vector" }],
    "#4a3a3a"
  ),
  color: new NodeType(
    "Color",
    [
      { name: "R", type: "float" },
      { name: "G", type: "float" },
      { name: "B", type: "float" },
    ],
    [{ name: "Color", type: "color" }],
    "#3a3a4a"
  ),
  texture: new NodeType(
    "Texture Sample",
    [
      { name: "Texture", type: "texture" },
      { name: "UV", type: "vector" },
    ],
    [{ name: "Color", type: "color" }],
    "#3a4a4a"
  ),
  output: new NodeType(
    "Output",
    [
      { name: "Color", type: "color" },
      { name: "Alpha", type: "float" },
    ],
    [],
    "#4a3a3a"
  ),
};

class Port {
  constructor(node, type, index, portDef) {
    this.node = node;
    this.type = type; // 'input' or 'output'
    this.index = index;
    this.connections = [];
    this.radius = 8;
    this.portType = portDef.type; // The data type (float, vector, etc.)
    this.name = portDef.name;
  }

  getPosition() {
    const node = this.node;
    const x = this.type === "input" ? node.x : node.x + node.width;
    const spacing = 40;
    const startY = node.y + 50;
    const y = startY + this.index * spacing;
    return { x, y };
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
    // Check type compatibility
    if (this.portType === "any" || otherPort.portType === "any") return true;
    return this.portType === otherPort.portType;
  }
}

class Node {
  constructor(x, y, id, nodeType) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = 180;
    this.nodeType = nodeType;
    this.title = nodeType.name;
    this.headerColor = nodeType.color;

    // Create ports based on node type definition
    this.inputPorts = nodeType.inputs.map(
      (inputDef, index) => new Port(this, "input", index, inputDef)
    );
    this.outputPorts = nodeType.outputs.map(
      (outputDef, index) => new Port(this, "output", index, outputDef)
    );

    // Calculate height based on number of ports
    const maxPorts = Math.max(this.inputPorts.length, this.outputPorts.length);
    this.height = 50 + maxPorts * 40 + 10;

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

    this.setupCanvas();
    this.setupEventListeners();
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

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("contextmenu", (e) => this.onContextMenu(e));

    // Setup node type buttons
    const nodeButtonsContainer = document.getElementById("nodeButtons");
    Object.entries(NODE_TYPES).forEach(([key, nodeType]) => {
      const btn = document.createElement("button");
      btn.textContent = nodeType.name;
      btn.className = "node-type-btn";
      btn.addEventListener("click", () => {
        this.addNode(
          100 + Math.random() * 300,
          100 + Math.random() * 200,
          nodeType
        );
      });
      nodeButtonsContainer.appendChild(btn);
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
      this.nodes = [];
      this.wires = [];
      this.render();
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
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
    const pos = this.getMousePos(e);
    const currentTime = Date.now();

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
      this.draggedRerouteNode = rerouteNode;
      rerouteNode.isDragging = true;
      return;
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

    // Check if clicking on a node header
    const node = this.findNodeAtPosition(pos.x, pos.y);
    if (node && node.isPointInHeader(pos.x, pos.y)) {
      this.draggedNode = node;
      node.isDragging = true;
      node.dragOffsetX = pos.x - node.x;
      node.dragOffsetY = pos.y - node.y;

      // Move to front
      this.nodes = this.nodes.filter((n) => n !== node);
      this.nodes.push(node);
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    // Update hovered port
    this.hoveredPort = this.findPortAtPosition(pos.x, pos.y);

    // Drag reroute node
    if (this.draggedRerouteNode) {
      this.draggedRerouteNode.x = pos.x;
      this.draggedRerouteNode.y = pos.y;
      this.render();
      return;
    }

    // Drag node
    if (this.draggedNode) {
      this.draggedNode.x = pos.x - this.draggedNode.dragOffsetX;
      this.draggedNode.y = pos.y - this.draggedNode.dragOffsetY;
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
      const node = this.findNodeAtPosition(pos.x, pos.y);
      if (node && node.isPointInHeader(pos.x, pos.y)) {
        this.canvas.style.cursor = "move";
      } else {
        this.canvas.style.cursor = "default";
      }
    }

    this.render();
  }

  onMouseUp(e) {
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
        } else {
          // Invalid connection, remove if it was picked up
          if (this.wires.includes(this.activeWire)) {
            this.disconnectWire(this.activeWire);
          }
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
        } else {
          // Invalid connection, remove if it was picked up
          if (this.wires.includes(this.activeWire)) {
            this.disconnectWire(this.activeWire);
          }
        }
      }
      this.activeWire = null;
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
  }

  drawGrid() {
    const ctx = this.ctx;
    const gridSize = 20;

    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
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
      ctx.fillStyle = rerouteNode.isDragging ? "#6ab0ff" : wireColor;
      ctx.strokeStyle = "#2d2d2d";
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
      ctx.fillText(label, pos.x + 15, pos.y + 4);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, pos.x - 15, pos.y + 4);
    }
  }

  drawNode(node) {
    const ctx = this.ctx;

    // Shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Node body
    ctx.fillStyle = "#2d2d2d";
    ctx.strokeStyle = node.isDragging ? "#4a90e2" : "#4a4a4a";
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

  render() {
    const ctx = this.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
  }
}

// Initialize the system
const canvas = document.getElementById("canvas");
const blueprint = new BlueprintSystem(canvas);

// Add a couple of starter nodes
blueprint.addNode(150, 150, NODE_TYPES.math);
blueprint.addNode(450, 200, NODE_TYPES.vector);
