// Blueprint Node System

// Port type definitions with colors
const PORT_TYPES = {
  float: { color: "#4a90e2", name: "Float", editable: true, defaultValue: 0.0 },
  int: { color: "#4a9fe2", name: "Int", editable: true, defaultValue: 0 },
  vector: { color: "#e2a44a", name: "Vector", editable: false },
  color: { color: "#e24a90", name: "Color", editable: false },
  texture: { color: "#90e24a", name: "Texture", editable: false },
  any: { color: "#888888", name: "Any", editable: false },
};

// Node type definitions
class NodeType {
  constructor(
    name,
    inputs,
    outputs,
    color = "#3a3a3a",
    dependency = "",
    execution = null
  ) {
    this.name = name;
    this.inputs = inputs; // Array of {name, type}
    this.outputs = outputs; // Array of {name, type}
    this.color = color;
    this.dependency = dependency; // GLSL code added once outside main
    this.execution = execution; // Function(inputVars, outputVars) => GLSL code
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
    "#3a4a3a",
    "", // No dependency
    (inputs, outputs) =>
      `    float ${outputs[0]} = ${inputs[0]} + ${inputs[1]};`
  ),
  vector: new NodeType(
    "Vector",
    [
      { name: "X", type: "float" },
      { name: "Y", type: "float" },
      { name: "Z", type: "float" },
    ],
    [{ name: "Vector", type: "vector" }],
    "#4a3a3a",
    "",
    (inputs, outputs) =>
      `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`
  ),
  color: new NodeType(
    "Color",
    [
      { name: "R", type: "float" },
      { name: "G", type: "float" },
      { name: "B", type: "float" },
    ],
    [{ name: "Color", type: "color" }],
    "#3a3a4a",
    "",
    (inputs, outputs) =>
      `    vec3 ${outputs[0]} = vec3(${inputs[0]}, ${inputs[1]}, ${inputs[2]});`
  ),
  texture: new NodeType(
    "Texture Sample",
    [
      { name: "Texture", type: "texture" },
      { name: "UV", type: "vector" },
    ],
    [{ name: "Color", type: "color" }],
    "#3a4a4a",
    "",
    (inputs, outputs) =>
      `    vec3 ${outputs[0]} = texture(${inputs[0]}, ${inputs[1]}.xy).rgb;`
  ),
  output: new NodeType(
    "Output",
    [
      { name: "Color", type: "color" },
      { name: "Alpha", type: "float" },
    ],
    [],
    "#4a3a3a",
    "",
    (inputs, outputs) => `    fragColor = vec4(${inputs[0]}, ${inputs[1]});`
  ),
  // Variable nodes - no inputs, only outputs
  varFloat: new NodeType(
    "Float Variable",
    [],
    [{ name: "Value", type: "float" }],
    PORT_TYPES.float.color,
    "",
    (inputs, outputs, node) => {
      const value = node.outputPorts[0].value || 0.0;
      return `    float ${outputs[0]} = ${value.toFixed(2)};`;
    }
  ),
  varInt: new NodeType(
    "Int Variable",
    [],
    [{ name: "Value", type: "int" }],
    PORT_TYPES.int.color,
    "",
    (inputs, outputs, node) => {
      const value = node.outputPorts[0].value || 0;
      return `    int ${outputs[0]} = ${value};`;
    }
  ),
  varVector: new NodeType(
    "Vector Variable",
    [],
    [{ name: "Value", type: "vector" }],
    PORT_TYPES.vector.color,
    "",
    (inputs, outputs) =>
      `    vec3 ${outputs[0]} = vec3(0.0, 0.0, 0.0); // Variable`
  ),
  varColor: new NodeType(
    "Color Variable",
    [],
    [{ name: "Value", type: "color" }],
    PORT_TYPES.color.color,
    "",
    (inputs, outputs) =>
      `    vec3 ${outputs[0]} = vec3(1.0, 1.0, 1.0); // Variable`
  ),
  varTexture: new NodeType(
    "Texture Variable",
    [],
    [{ name: "Value", type: "texture" }],
    PORT_TYPES.texture.color,
    "",
    (inputs, outputs) => `    sampler2D ${outputs[0]} = uTexture; // Variable`
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
    this.nodeType = nodeType;
    this.title = nodeType.name;
    this.headerColor = nodeType.color;
    this.isVariable =
      nodeType.inputs.length === 0 && nodeType.outputs.length > 0;

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

    this.setupCanvas();
    this.setupEventListeners();
    this.setupInputField();
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

  startEditingPort(port) {
    if (!port.isEditable || port.connections.length > 0) return;

    this.editingPort = port;
    const bounds = port.getValueBoxBounds(this.ctx);
    const rect = this.canvas.getBoundingClientRect();

    this.inputField.value = port.value.toString();
    this.inputField.style.left = `${rect.left + window.scrollX + bounds.x}px`;
    this.inputField.style.top = `${rect.top + window.scrollY + bounds.y}px`;
    this.inputField.style.width = `${bounds.width}px`;
    this.inputField.style.height = `${bounds.height}px`;
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

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("contextmenu", (e) => this.onContextMenu(e));

    // Setup node type buttons
    const nodeButtonsContainer = document.getElementById("nodeButtons");

    // Separate variables from regular nodes
    const regularNodes = {};
    const variableNodes = {};

    Object.entries(NODE_TYPES).forEach(([key, nodeType]) => {
      if (key.startsWith("var")) {
        variableNodes[key] = nodeType;
      } else {
        regularNodes[key] = nodeType;
      }
    });

    // Add regular node buttons
    Object.entries(regularNodes).forEach(([key, nodeType]) => {
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

    // Add separator
    const separator = document.createElement("div");
    separator.style.width = "2px";
    separator.style.height = "30px";
    separator.style.background = "#4a4a4a";
    separator.style.margin = "0 10px";
    nodeButtonsContainer.appendChild(separator);

    // Add variable node buttons
    Object.entries(variableNodes).forEach(([key, nodeType]) => {
      const btn = document.createElement("button");
      btn.textContent = nodeType.name;
      btn.className = "node-type-btn variable-btn";
      btn.style.background = nodeType.color;
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
      this.updateDependencyList();
    });

    document
      .getElementById("toggleSidebarBtn")
      .addEventListener("click", () => {
        this.toggleSidebar();
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

  exportGLSL() {
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

    // Collect unique dependencies
    const dependencies = new Set();
    for (const level of levels) {
      for (const node of level) {
        if (node.nodeType.dependency) {
          dependencies.add(node.nodeType.dependency);
        }
      }
    }

    // Build GLSL shader
    let glsl = "";

    // Add boilerplate
    glsl += "#version 330 core\n\n";
    glsl += "// Generated shader from Blueprint System\n\n";
    glsl += "out vec4 fragColor;\n";
    glsl += "in vec2 vUV;\n\n";
    glsl += "// Uniforms (add as needed)\n";
    glsl += "uniform sampler2D uTexture;\n\n";

    // Add dependencies
    if (dependencies.size > 0) {
      glsl += "// Function dependencies\n";
      for (const dep of dependencies) {
        glsl += dep + "\n\n";
      }
    }

    // Start main function
    glsl += "void main() {\n";

    // Generate execution code for each node in order
    for (const level of levels) {
      for (const node of level) {
        if (node.nodeType.execution) {
          // Get input variable names
          const inputVars = node.inputPorts.map(
            (port) => portToVarName.get(port) || "0.0"
          );

          // Get output variable names
          const outputVars = node.outputPorts.map((port) =>
            portToVarName.get(port)
          );

          // Generate code
          const code = node.nodeType.execution(inputVars, outputVars, node);
          glsl += code + "\n";
        }
      }
    }

    glsl += "}\n";

    // Download the shader
    this.downloadFile("shader.frag", glsl);

    // Also show in console
    console.log("Generated GLSL Shader:");
    console.log(glsl);
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
      ctx.strokeStyle = node.isDragging
        ? "#ffffff"
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
