import { NODE_TYPES } from "./nodes/index.js";

const API_VERSION = "1.0.0";
const API_NAMESPACE = "shaderGraphAPI";
const API_ALIAS = "sg";
const PREVIEWABLE_TYPES = new Set(["float", "vec2", "vec3", "vec4"]);
const PREVIEW_SETTING_KEYS = new Set([
  "effectTarget",
  "object",
  "cameraMode",
  "autoRotate",
  "samplingMode",
  "shaderLanguage",
  "spriteTextureUrl",
  "shapeTextureUrl",
  "bgTextureUrl",
  "showBackgroundCube",
  "spriteScale",
  "shapeScale",
  "roomScale",
  "bgOpacity",
  "bg3dOpacity",
  "zoomLevel",
  "startupScript",
]);

function cloneValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "function") {
    return undefined;
  }

  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    // Fall back to JSON serialization for values that cannot be structured-cloned.
  }

  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, message) {
  assert(isPlainObject(value), message);
}

function assertOptionalPlainObject(value, message) {
  if (value === undefined) {
    return;
  }

  assertPlainObject(value, message);
}

function assertNonEmptyString(value, message) {
  assert(typeof value === "string" && value.trim() !== "", message);
}

function assertOptionalString(value, message) {
  if (value === undefined) {
    return;
  }

  assert(typeof value === "string", message);
}

function assertFiniteNumber(value, message) {
  assert(typeof value === "number" && Number.isFinite(value), message);
}

function assertOptionalFiniteNumber(value, message) {
  if (value === undefined) {
    return;
  }

  assertFiniteNumber(value, message);
}

function assertOptionalBoolean(value, message) {
  if (value === undefined) {
    return;
  }

  assert(typeof value === "boolean", message);
}

function assertOptionalArray(value, message) {
  if (value === undefined) {
    return;
  }

  assert(Array.isArray(value), message);
}

function assertOptionalStringOrArray(value, message) {
  if (value === undefined) {
    return;
  }

  assert(typeof value === "string" || Array.isArray(value), message);
}

function assertOneOf(value, allowed, message) {
  assert(allowed.includes(value), message);
}

function assertOptionalOneOf(value, allowed, message) {
  if (value === undefined) {
    return;
  }

  assertOneOf(value, allowed, message);
}

function normalizeOptionalString(value) {
  return value === undefined ? undefined : value.trim();
}

function normalizeSummaryLines(value) {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry != null && String(entry).trim() !== "")
      .map(String);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function sanitizeGraphLocalId(value, fallback = "node") {
  const normalized = String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || fallback;
}

function worldCenter(bp) {
  return {
    x:
      (-bp.camera.x + (bp.logicalWidth || bp.canvas.width) / 2) /
      bp.camera.zoom,
    y:
      (-bp.camera.y + (bp.logicalHeight || bp.canvas.height) / 2) /
      bp.camera.zoom,
  };
}

function getNodeById(bp, nodeId) {
  const node = bp.nodes.find((entry) => entry.id === Number(nodeId));
  assert(node, `Node ${nodeId} not found`);
  return node;
}

function getUniformById(bp, uniformId) {
  const uniform = bp.uniforms.find((entry) => entry.id === Number(uniformId));
  assert(uniform, `Uniform ${uniformId} not found`);
  return uniform;
}

function getWireId(bp, wire) {
  if (wire.id == null) {
    wire.id = bp.wireIdCounter++;
  }

  return wire.id;
}

function assignMissingWireIds(bp) {
  if (!Number.isInteger(bp.wireIdCounter) || bp.wireIdCounter < 1) {
    bp.wireIdCounter = 1;
  }

  bp.wires.forEach((wire) => {
    getWireId(bp, wire);
  });
}

function normalizeTypeSnapshot(nodeType, typeKey) {
  if (!nodeType) {
    return null;
  }

  return {
    key: typeKey,
    name: nodeType.name,
    category: nodeType.category,
    color: nodeType.color,
    tags: [...(nodeType.tags || [])],
    inputs: (nodeType.inputs || []).map((port) => ({ ...port })),
    outputs: (nodeType.outputs || []).map((port) => ({ ...port })),
    hasOperation: !!nodeType.hasOperation,
    operationOptions: cloneValue(nodeType.operationOptions || []),
    hasCustomInput: !!nodeType.hasCustomInput,
    customInputConfig: cloneValue(nodeType.customInputConfig || null),
    hasVariableDropdown: !!nodeType.hasVariableDropdown,
    hasCustomEditor: !!nodeType.hasCustomEditor,
    customEditorConfig: cloneValue(nodeType.customEditorConfig || null),
    isUniform: !!nodeType.isUniform,
    uniformId: nodeType.uniformId ?? null,
    isCustom: !!nodeType.isCustom,
    customNodeId: nodeType.customNodeId ?? null,
    manual: cloneValue(nodeType.manual || null),
  };
}

function serializeNodeTypeSummary(nodeType, typeKey) {
  if (!nodeType) {
    return null;
  }

  return {
    key: typeKey,
    name: nodeType.name,
    category: nodeType.category,
    tags: [...(nodeType.tags || [])],
  };
}

function getAllNodeTypes(bp) {
  const types = new Map();

  Object.entries(NODE_TYPES).forEach(([key, nodeType]) => {
    types.set(key, serializeNodeTypeSummary(nodeType, key));
  });

  Object.entries(bp.getUniformNodeTypes()).forEach(([key, nodeType]) => {
    types.set(key, serializeNodeTypeSummary(nodeType, key));
  });

  Object.entries(bp.getCustomNodeTypes()).forEach(([key, nodeType]) => {
    types.set(key, serializeNodeTypeSummary(nodeType, key));
  });

  return [...types.values()];
}

function serializeCustomNodeDefinition(customNode) {
  return {
    id: customNode.id,
    key: `custom_${customNode.id}`,
    name: customNode.name,
    color: customNode.color,
    splitWebGL: customNode.splitWebGL !== false,
    inputs: cloneValue(customNode.inputs || []),
    outputs: cloneValue(customNode.outputs || []),
    code: cloneValue(customNode.code || {}),
  };
}

function filterNodeTypes(types, query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return types;
  }

  return types.filter((entry) => {
    const haystack = [
      entry.key,
      entry.name,
      entry.category,
      ...(entry.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function serializePort(bp, port) {
  const wireIds = port.connections.map((wire) => getWireId(bp, wire));

  return {
    id: `node:${port.node.id}:${port.type}:${port.index}`,
    nodeId: port.node.id,
    nodeTypeKey: bp.getNodeTypeKey(port.node.nodeType),
    kind: port.type,
    index: port.index,
    name: port.name,
    displayName: port.displayName,
    declaredType: port.portType,
    resolvedType: port.getResolvedType(),
    isEditable: !!port.isEditable,
    value: cloneValue(port.value),
    connectionCount: port.connections.length,
    wireIds,
  };
}

function serializeNode(bp, node) {
  return {
    id: node.id,
    typeKey: bp.getNodeTypeKey(node.nodeType),
    title: node.title,
    displayTitle: node.displayTitle,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    operation: node.operation ?? null,
    customInput: node.customInput ?? null,
    selectedVariable: node.selectedVariable ?? null,
    data: cloneValue(node.data),
    uniformId: node.uniformId ?? null,
    uniformName: node.uniformName ?? null,
    uniformDisplayName: node.uniformDisplayName ?? null,
    uniformVariableName: node.uniformVariableName ?? null,
    isVariable: !!node.isVariable,
    isPreviewNode: bp.previewNode === node,
    ports: {
      inputs: node.inputPorts.map((port) => serializePort(bp, port)),
      outputs: node.outputPorts.map((port) => serializePort(bp, port)),
    },
    editableInputValues: getEditableInputValueSuggestions(node),
  };
}

function serializeNodeSummary(bp, node) {
  return {
    id: node.id,
    typeKey: bp.getNodeTypeKey(node.nodeType),
    title: node.title,
    displayTitle: node.displayTitle,
  };
}

function resolveNodeIdRef(nodeRef) {
  if (Number.isInteger(Number(nodeRef))) {
    return Number(nodeRef);
  }

  if (nodeRef && typeof nodeRef === "object") {
    if (Number.isInteger(Number(nodeRef.nodeId))) {
      return Number(nodeRef.nodeId);
    }

    if (Number.isInteger(Number(nodeRef.id))) {
      return Number(nodeRef.id);
    }
  }

  return null;
}

function deleteNodesInternal(bp, nodeRefs) {
  const nodeIds = [
    ...new Set(nodeRefs.map((nodeRef) => resolveNodeIdRef(nodeRef))),
  ];
  assert(nodeIds.length > 0, "At least one valid node reference is required");
  assert(
    nodeIds.every((nodeId) => Number.isInteger(nodeId)),
    "All node references must resolve to valid node ids",
  );

  const nodes = nodeIds.map((nodeId) => getNodeById(bp, nodeId));
  nodes.forEach((node) => {
    assert(
      bp.getNodeTypeKey(node.nodeType) !== "output",
      "The Output node cannot be deleted",
    );
  });

  const connectedWires = new Set();
  nodes.forEach((node) => {
    node.getAllPorts().forEach((port) => {
      port.connections.forEach((wire) => connectedWires.add(wire));
    });
  });

  connectedWires.forEach((wire) => bp.disconnectWire(wire));
  bp.nodes = bp.nodes.filter((entry) => !nodes.includes(entry));
  nodes.forEach((node) => {
    bp.selectedNodes.delete(node);
    if (bp.previewNode === node) {
      bp.previewNode = null;
    }
  });

  return nodes;
}

function serializeUniform(uniform, index) {
  return {
    id: uniform.id,
    index,
    name: uniform.name,
    variableName: uniform.variableName,
    description: uniform.description,
    type: uniform.type,
    value: cloneValue(uniform.value),
    isPercent: !!uniform.isPercent,
  };
}

function serializeWire(bp, wire) {
  return {
    id: getWireId(bp, wire),
    from: serializePort(bp, wire.startPort),
    to: serializePort(bp, wire.endPort),
    rerouteNodes: wire.rerouteNodes.map((node, index) => ({
      index,
      x: node.x,
      y: node.y,
    })),
  };
}

function serializeWireSummary(bp, wire) {
  return {
    id: getWireId(bp, wire),
    from: {
      nodeId: wire.startPort.node.id,
      nodeTypeKey: bp.getNodeTypeKey(wire.startPort.node.nodeType),
      kind: wire.startPort.type,
      index: wire.startPort.index,
      name: wire.startPort.name,
    },
    to: {
      nodeId: wire.endPort.node.id,
      nodeTypeKey: bp.getNodeTypeKey(wire.endPort.node.nodeType),
      kind: wire.endPort.type,
      index: wire.endPort.index,
      name: wire.endPort.name,
    },
    rerouteCount: wire.rerouteNodes.length,
  };
}

function serializePreviewConsoleEntry(entry) {
  const time = entry.time instanceof Date ? entry.time : new Date(entry.time);
  return {
    level: entry.level,
    message: entry.message,
    time: time.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    timestamp: time.toISOString(),
  };
}

function countUpstreamNodes(node, visited = new Set()) {
  if (!node || visited.has(node.id)) {
    return 0;
  }

  visited.add(node.id);
  let count = 1;

  node.inputPorts.forEach((port) => {
    port.connections.forEach((wire) => {
      count += countUpstreamNodes(wire.startPort.node, visited);
    });
  });

  return count;
}

function getAiWarnings(bp) {
  const warnings = [];

  bp.nodes.forEach((node) => {
    node.outputPorts.forEach((port) => {
      if (port.connections.length <= 1) {
        return;
      }

      const distinctTargetNodeIds = new Set(
        port.connections.map((wire) => wire.endPort.node.id),
      );
      if (distinctTargetNodeIds.size <= 1) {
        return;
      }

      const subtreeSize = countUpstreamNodes(node);
      const portSnapshot = serializePort(bp, port);
      warnings.push({
        type: "output-fanout",
        severity: "warning",
        nodeId: node.id,
        nodeTypeKey: bp.getNodeTypeKey(node.nodeType),
        port: portSnapshot,
        connectionCount: port.connections.length,
        distinctTargetNodeCount: distinctTargetNodeIds.size,
        upstreamNodeCount: subtreeSize,
        recommendation:
          subtreeSize > 1
            ? "This output fans out multiple times from a larger computed tree. Prefer a Set Variable / Get Variable pattern to keep layout clean."
            : "This output fans out multiple times from a small local node. Prefer duplicating the node or using a variable if the branch grows.",
      });
    });
  });

  return warnings;
}

async function runAiDebugCheck(bp, api, options = {}) {
  const generatedCode = (() => {
    try {
      return {
        ok: true,
        data: api.shader.getGeneratedCode(),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  const previewErrors = api.preview.getErrors({
    limit: options.previewErrorLimit ?? 50,
  });
  const warnings = api.ai.getWarnings();

  let screenshot = null;
  if (options.includeScreenshot || options.takeScreenshot) {
    screenshot = await api.preview.screenshot({ download: false });
  }

  return {
    ok: generatedCode.ok && previewErrors.length === 0,
    generatedCode,
    previewErrors,
    warnings,
    screenshot,
  };
}

function serializeCamera(bp) {
  return {
    x: bp.camera.x,
    y: bp.camera.y,
    zoom: bp.camera.zoom,
  };
}

function resolvePortRef(bp, portRef, expectedKind = null) {
  assert(
    portRef && typeof portRef === "object",
    "Port reference must be an object",
  );

  const node = getNodeById(bp, portRef.nodeId);
  const kind = portRef.kind || portRef.type;
  assert(
    kind === "input" || kind === "output",
    "Port reference kind must be 'input' or 'output'",
  );
  if (expectedKind) {
    assert(kind === expectedKind, `Expected a ${expectedKind} port reference`);
  }

  const ports = kind === "input" ? node.inputPorts : node.outputPorts;
  let port = null;

  if (Number.isInteger(portRef.index)) {
    port = ports[portRef.index] || null;
  } else if (portRef.name != null) {
    port = ports.find((entry) => entry.name === portRef.name) || null;
  }

  assert(
    port,
    `Port not found on node ${node.id} (${bp.getNodeTypeKey(node.nodeType)}), requested ${kind} port ${portRef.name ?? portRef.index}`,
  );
  return port;
}

function getWireByRef(bp, wireRef) {
  if (typeof wireRef === "number" || typeof wireRef === "string") {
    const wireId = Number(wireRef);
    assert(
      Number.isInteger(wireId),
      `Wire reference '${wireRef}' must be a valid wire id`,
    );
    const wire = bp.wires.find((entry) => getWireId(bp, entry) === wireId);
    assert(wire, `Wire ${wireRef} not found`);
    return wire;
  }

  assert(
    wireRef && typeof wireRef === "object",
    "Wire reference must be an id or object",
  );
  const from = resolvePortRef(bp, wireRef.from, "output");
  const to = resolvePortRef(bp, wireRef.to, "input");
  const wire = bp.wires.find(
    (entry) => entry.startPort === from && entry.endPort === to,
  );
  assert(wire, "Wire not found for the provided from/to ports");
  return wire;
}

function validateVariableName(bp, node, value) {
  const config = node.nodeType.customInputConfig;
  if (!config?.validate) {
    return value;
  }

  const validation = config.validate(value, node);
  assert(validation.valid, validation.error || "Invalid custom input value");
  return validation.newValue !== undefined ? validation.newValue : value;
}

function validateVersionString(value) {
  assert(typeof value === "string", "Version must be a string");
  assert(
    /^\d+(?:\.\d+){3}$/.test(value.trim()),
    "Version must use X.X.X.X format",
  );
  return value.trim();
}

function validateBumpVersion(value) {
  assert(typeof value === "string", "bumpVersion must be a string");
  const normalized = value.trim();
  assertOneOf(
    normalized,
    ["major", "minor", "patch"],
    "bumpVersion must be 'major', 'minor', or 'patch'",
  );
  return normalized;
}

function pushHistory(bp, label) {
  bp.history.pushState(label);
}

function finalizeNodeChange(bp, label) {
  bp.render();
  bp.updateDependencyList();
  bp.onShaderChanged();
  pushHistory(bp, label);
}

function buildPortTypeErrorMessage(startPort, endPort) {
  const startType = startPort.getResolvedType();
  const endType = endPort.getResolvedType();
  return [
    "Ports are not compatible for connection",
    `from node ${startPort.node.id} output '${startPort.name}' (${startType})`,
    `to node ${endPort.node.id} input '${endPort.name}' (${endType})`,
  ].join(": ");
}

function buildIrPortRef(localNodeId, portName) {
  assertNonEmptyString(
    localNodeId,
    "IR wire node id must be a non-empty string",
  );
  assertNonEmptyString(
    portName,
    "IR wire port name must be a non-empty string",
  );
  return `${localNodeId}.${portName}`;
}

function parseIrPortRef(ref, fieldName = "port ref") {
  assertNonEmptyString(ref, `${fieldName} must be a non-empty string`);
  const dotIndex = ref.indexOf(".");
  assert(
    dotIndex > 0 && dotIndex < ref.length - 1,
    `${fieldName} must use '<nodeId>.<portName>' format`,
  );
  return {
    nodeId: ref.slice(0, dotIndex),
    portName: ref.slice(dotIndex + 1),
  };
}

function ensureIrNodesArray(ir) {
  const nodes = Array.isArray(ir.nodes) ? ir.nodes : [];
  assert(nodes.length > 0, "graph IR requires a non-empty nodes array");
  return nodes;
}

function ensureIrWiresArray(ir) {
  if (ir.wires === undefined) {
    return [];
  }
  assert(Array.isArray(ir.wires), "graph IR wires must be an array");
  return ir.wires;
}

function normalizeIrNodeTypeKey(irNode) {
  const typeKey = irNode.typeKey ?? irNode.type;
  assertNonEmptyString(
    typeKey,
    `IR node '${irNode.id ?? "<unknown>"}' requires a type or typeKey`,
  );
  if (typeKey === "uniform") {
    const uniformRef = irNode.uniform ?? irNode.uniformName ?? irNode.uniformId;
    assert(
      uniformRef !== undefined && uniformRef !== null,
      `IR node '${irNode.id}' requires a uniform reference`,
    );
    return { typeKey: "uniform", uniformRef };
  }
  return { typeKey, uniformRef: null };
}

function getOutputNode(bp) {
  const outputNode = bp.nodes.find(
    (node) => bp.getNodeTypeKey(node.nodeType) === "output",
  );
  assert(outputNode, "Graph is missing its Output node");
  return outputNode;
}

function resolveUniformRefFromIr(bp, uniformRef) {
  if (Number.isInteger(Number(uniformRef))) {
    return getUniformById(bp, Number(uniformRef));
  }
  const ref = String(uniformRef).trim();
  assert(ref, "Uniform reference must be a non-empty string or integer id");
  const uniform = bp.uniforms.find(
    (entry) => entry.name === ref || entry.variableName === ref,
  );
  assert(uniform, `Uniform '${ref}' not found`);
  return uniform;
}

function exportGraphIR(bp) {
  const nodeSummaries = bp.nodes.map((node) => ({
    localId: sanitizeGraphLocalId(
      `${bp.getNodeTypeKey(node.nodeType) || "node"}_${node.id}`,
      `node_${node.id}`,
    ),
    node,
  }));
  const usedLocalIds = new Set();
  nodeSummaries.forEach((entry) => {
    let candidate = entry.localId;
    let counter = 2;
    while (usedLocalIds.has(candidate)) {
      candidate = `${entry.localId}_${counter}`;
      counter++;
    }
    entry.localId = candidate;
    usedLocalIds.add(candidate);
  });

  const localIdByNodeId = new Map(
    nodeSummaries.map((entry) => [entry.node.id, entry.localId]),
  );

  return {
    version: 1,
    autoLayout: true,
    nodes: nodeSummaries.map(({ localId, node }) => {
      const typeKey = bp.getNodeTypeKey(node.nodeType);
      const irNode = {
        id: localId,
        type: node.nodeType.isUniform ? "uniform" : typeKey,
      };

      if (node.nodeType.isUniform) {
        irNode.uniform =
          node.uniformDisplayName || node.uniformName || node.uniformId;
      }

      if (node.operation !== undefined) {
        irNode.operation = node.operation;
      }
      if (node.customInput !== undefined) {
        irNode.customInput = node.customInput;
      }
      if (node.selectedVariable !== undefined) {
        irNode.selectedVariable = node.selectedVariable;
      }
      if (node.data !== undefined) {
        irNode.data = cloneValue(node.data);
      }

      const inputValues = {};
      node.inputPorts.forEach((port) => {
        if (
          port.isEditable &&
          port.connections.length === 0 &&
          port.value !== undefined
        ) {
          inputValues[port.name] = cloneValue(port.value);
        }
      });
      if (Object.keys(inputValues).length > 0) {
        irNode.inputValues = inputValues;
      }

      return irNode;
    }),
    wires: bp.wires.map((wire) => ({
      from: buildIrPortRef(
        localIdByNodeId.get(wire.startPort.node.id),
        wire.startPort.name,
      ),
      to: buildIrPortRef(
        localIdByNodeId.get(wire.endPort.node.id),
        wire.endPort.name,
      ),
    })),
  };
}

function validateGraphIR(bp, ir) {
  assertPlainObject(ir, "graph.validateIR requires an IR object");
  const nodes = ensureIrNodesArray(ir);
  const wires = ensureIrWiresArray(ir);
  const nodeMap = new Map();
  const errors = [];
  let outputNodeCount = 0;

  nodes.forEach((irNode, index) => {
    if (!isPlainObject(irNode)) {
      errors.push({
        type: "node",
        index,
        message: `IR node at index ${index} must be an object`,
      });
      return;
    }

    const localId = String(irNode.id || "").trim();
    if (!localId) {
      errors.push({
        type: "node",
        index,
        message: `IR node at index ${index} requires a non-empty id`,
      });
      return;
    }
    if (nodeMap.has(localId)) {
      errors.push({
        type: "node",
        id: localId,
        message: `Duplicate IR node id '${localId}'`,
      });
      return;
    }

    try {
      const { typeKey, uniformRef } = normalizeIrNodeTypeKey(irNode);
      let nodeType = null;
      if (typeKey === "uniform") {
        const uniform = resolveUniformRefFromIr(bp, uniformRef);
        nodeType = bp.getUniformNodeTypes()[`uniform_${uniform.id}`] || null;
      } else {
        nodeType = bp.getNodeTypeFromKey(typeKey);
      }
      assert(nodeType, `Unknown node type '${typeKey}'`);

      if (typeKey === "output") {
        outputNodeCount += 1;
      }

      nodeMap.set(localId, {
        id: localId,
        typeKey,
        uniformRef,
        nodeType,
        irNode,
      });
    } catch (error) {
      errors.push({
        type: "node",
        id: localId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (outputNodeCount > 1) {
    errors.push({
      type: "graph",
      message: "IR may reference at most one output node",
    });
  }

  wires.forEach((wire, index) => {
    try {
      assertPlainObject(wire, `IR wire at index ${index} must be an object`);
      const fromRef = parseIrPortRef(wire.from, `IR wire ${index} from`);
      const toRef = parseIrPortRef(wire.to, `IR wire ${index} to`);
      const fromNode = nodeMap.get(fromRef.nodeId);
      const toNode = nodeMap.get(toRef.nodeId);
      assert(
        fromNode,
        `IR wire ${index} references missing from node '${fromRef.nodeId}'`,
      );
      assert(
        toNode,
        `IR wire ${index} references missing to node '${toRef.nodeId}'`,
      );

      const fromPortDef = (fromNode.nodeType.outputs || []).find(
        (port) => port.name === fromRef.portName,
      );
      const toPortDef = (toNode.nodeType.inputs || []).find(
        (port) => port.name === toRef.portName,
      );
      assert(
        fromPortDef,
        `IR wire ${index} output '${wire.from}' does not exist`,
      );
      assert(toPortDef, `IR wire ${index} input '${wire.to}' does not exist`);

      assert(
        typeof bp.createDetachedNode === "function",
        "Blueprint does not support detached node creation",
      );
      const startNode = bp.createDetachedNode(
        fromNode.nodeType,
        0,
        0,
        -100000 - index * 2,
      );
      const endNode = bp.createDetachedNode(
        toNode.nodeType,
        0,
        0,
        -100001 - index * 2,
      );

      if (fromNode.irNode.operation !== undefined) {
        startNode.operation = fromNode.irNode.operation;
      }
      if (fromNode.irNode.customInput !== undefined) {
        startNode.customInput = fromNode.irNode.customInput;
      }
      if (fromNode.irNode.selectedVariable !== undefined) {
        startNode.selectedVariable = fromNode.irNode.selectedVariable;
      }
      if (toNode.irNode.operation !== undefined) {
        endNode.operation = toNode.irNode.operation;
      }
      if (toNode.irNode.customInput !== undefined) {
        endNode.customInput = toNode.irNode.customInput;
      }
      if (toNode.irNode.selectedVariable !== undefined) {
        endNode.selectedVariable = toNode.irNode.selectedVariable;
      }

      const startPort = startNode.outputPorts.find(
        (port) => port.name === fromRef.portName,
      );
      const endPort = endNode.inputPorts.find(
        (port) => port.name === toRef.portName,
      );
      assert(startPort && endPort, `IR wire ${index} could not resolve ports`);
      assert(
        startPort.canConnectTo(endPort),
        buildPortTypeErrorMessage(startPort, endPort),
      );
    } catch (error) {
      errors.push({
        type: "wire",
        index,
        wire: cloneValue(wire),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    ok: errors.length === 0,
    nodeCount: nodes.length,
    wireCount: wires.length,
    errors,
  };
}

function importGraphIR(bp, ir, options = {}) {
  const validation = validateGraphIR(bp, ir);
  if (options.validateOnly) {
    return validation;
  }
  assert(
    validation.ok,
    `graph.importIR validation failed: ${validation.errors[0]?.message || "unknown error"}`,
  );

  const createdNodes = [];
  const localToNodeId = new Map();
  const positions = [];
  const defaultPosition =
    options.position &&
    Number.isFinite(options.position.x) &&
    Number.isFinite(options.position.y)
      ? { x: Number(options.position.x), y: Number(options.position.y) }
      : worldCenter(bp);
  let cursorX = defaultPosition.x;
  let cursorY = defaultPosition.y;

  const nodes = ensureIrNodesArray(ir);
  const wires = ensureIrWiresArray(ir);

  nodes.forEach((irNode, index) => {
    const { typeKey, uniformRef } = normalizeIrNodeTypeKey(irNode);
    let node;
    if (typeKey === "output") {
      node = getOutputNode(bp);
    } else if (typeKey === "uniform") {
      const uniform = resolveUniformRefFromIr(bp, uniformRef);
      node = bp.createUniformNode(uniform, cursorX, cursorY);
    } else {
      const nodeType = bp.getNodeTypeFromKey(typeKey);
      node = bp.addNode(cursorX, cursorY, nodeType);
    }

    if (irNode.operation !== undefined) {
      applyNodePatch(bp, node, { operation: irNode.operation });
    }
    if (irNode.customInput !== undefined) {
      applyNodePatch(bp, node, { customInput: irNode.customInput });
    }
    if (irNode.selectedVariable !== undefined) {
      applyNodePatch(bp, node, { selectedVariable: irNode.selectedVariable });
    }
    if (irNode.data !== undefined) {
      applyNodePatch(bp, node, { data: irNode.data });
    }
    if (irNode.inputValues !== undefined) {
      applyNodePatch(bp, node, { inputValues: irNode.inputValues });
    }

    createdNodes.push(node);
    localToNodeId.set(irNode.id, node.id);
    positions.push({
      localId: irNode.id,
      nodeId: node.id,
      x: node.x,
      y: node.y,
    });

    if (typeKey !== "output") {
      cursorX += 220;
      if ((index + 1) % 6 === 0) {
        cursorX = defaultPosition.x;
        cursorY += 140;
      }
    }
  });

  const createdWires = [];
  wires.forEach((wire) => {
    const fromRef = parseIrPortRef(wire.from, "IR wire from");
    const toRef = parseIrPortRef(wire.to, "IR wire to");
    const startPort = resolvePortRef(
      bp,
      {
        nodeId: localToNodeId.get(fromRef.nodeId),
        kind: "output",
        name: fromRef.portName,
      },
      "output",
    );
    const endPort = resolvePortRef(
      bp,
      {
        nodeId: localToNodeId.get(toRef.nodeId),
        kind: "input",
        name: toRef.portName,
      },
      "input",
    );
    assert(
      startPort.canConnectTo(endPort),
      buildPortTypeErrorMessage(startPort, endPort),
    );

    if (endPort.connections.length > 0) {
      bp.disconnectWire(endPort.connections[0]);
    }

    const wireInstance = new bp.WireClass(startPort, endPort);
    getWireId(bp, wireInstance);
    bp.wires.push(wireInstance);
    startPort.connections.push(wireInstance);
    endPort.connections.push(wireInstance);
    bp.resolveGenericsForConnection(startPort, endPort);
    endPort.updateEditability();
    createdWires.push(wireInstance);
  });

  createdNodes.forEach((node) => {
    node.inputPorts.forEach((port) => port.updateEditability());
    node.outputPorts.forEach((port) => port.updateEditability());
    node.recalculateHeight();
  });

  if (ir.autoLayout !== false && options.autoLayout !== false) {
    bp.selectedNodes.clear();
    createdNodes.forEach((node) => {
      node.isSelected = true;
      bp.selectedNodes.add(node);
    });
    bp.autoArrange();
  }

  finalizeNodeChange(
    bp,
    options.historyLabel || `Import graph IR (${createdNodes.length} nodes)`,
  );

  return {
    ok: true,
    imported: {
      nodeCount: createdNodes.length,
      wireCount: createdWires.length,
      nodeIds: createdNodes.map((node) => node.id),
      wireIds: createdWires.map((wire) => getWireId(bp, wire)),
      localToNodeId: Object.fromEntries(localToNodeId.entries()),
    },
    validation,
  };
}

function rewriteFanoutAsVariable(
  bp,
  { nodeId, outputIndex = 0, outputName, variableName, autoLayout = true } = {},
) {
  assert(
    Number.isInteger(Number(nodeId)),
    "graph.rewriteFanoutAsVariable requires a valid nodeId",
  );
  const node = getNodeById(bp, nodeId);
  const outputPort =
    outputName != null
      ? node.outputPorts.find((port) => port.name === outputName)
      : node.outputPorts[Number(outputIndex) || 0];
  assert(outputPort, `Output port not found on node ${node.id}`);
  assert(
    outputPort.connections.length > 1,
    `Node ${node.id} output '${outputPort.name}' does not fan out`,
  );

  const connections = [...outputPort.connections];
  const rootName = sanitizeGraphLocalId(
    variableName || `${node.title}_${outputPort.name}`,
    "graph_value",
  );
  let nextName = rootName;
  let counter = 2;
  while (
    bp.nodes.some(
      (entry) =>
        entry.nodeType.name === "Set Variable" &&
        entry.customInput === nextName,
    )
  ) {
    nextName = `${rootName}_${counter}`;
    counter++;
  }

  const setNode = bp.addNode(
    node.x + 220,
    node.y,
    bp.getNodeTypeFromKey("setVariable"),
  );
  setNode._blueprintSystem = bp;
  applyNodePatch(bp, setNode, { customInput: nextName });

  const createdGetNodes = [];
  const createdWires = [];
  const selectedNodeIds = new Set([node.id, setNode.id]);

  const setWire = new bp.WireClass(outputPort, setNode.inputPorts[0]);
  getWireId(bp, setWire);
  bp.wires.push(setWire);
  outputPort.connections.push(setWire);
  setNode.inputPorts[0].connections.push(setWire);
  bp.resolveGenericsForConnection(outputPort, setNode.inputPorts[0]);
  createdWires.push(setWire);

  connections.forEach((wire, index) => {
    const targetPort = wire.endPort;
    const getNode = bp.addNode(
      targetPort.node.x - 220,
      targetPort.node.y + index * 45,
      bp.getNodeTypeFromKey("getVariable"),
    );
    getNode._blueprintSystem = bp;
    applyNodePatch(bp, getNode, { selectedVariable: nextName });
    selectedNodeIds.add(getNode.id);
    createdGetNodes.push(getNode);

    bp.disconnectWire(wire);

    const replacementWire = new bp.WireClass(
      getNode.outputPorts[0],
      targetPort,
    );
    getWireId(bp, replacementWire);
    bp.wires.push(replacementWire);
    getNode.outputPorts[0].connections.push(replacementWire);
    targetPort.connections.push(replacementWire);
    bp.resolveGenericsForConnection(getNode.outputPorts[0], targetPort);
    createdWires.push(replacementWire);
  });

  [setNode, ...createdGetNodes, node].forEach((entry) => {
    entry.inputPorts.forEach((port) => port.updateEditability());
    entry.outputPorts.forEach((port) => port.updateEditability());
    entry.recalculateHeight();
  });

  if (autoLayout) {
    bp.selectedNodes.clear();
    bp.nodes.forEach((entry) => {
      entry.isSelected = selectedNodeIds.has(entry.id);
      if (entry.isSelected) {
        bp.selectedNodes.add(entry);
      }
    });
    bp.autoArrange();
  }

  finalizeNodeChange(bp, `Rewrite fan-out as variable (${nextName})`);

  return {
    ok: true,
    variableName: nextName,
    setNodeId: setNode.id,
    getNodeIds: createdGetNodes.map((entry) => entry.id),
    replacedConnectionCount: connections.length,
  };
}

function deleteDanglingNodes(bp, { autoLayout = false } = {}) {
  const keepNodeIds = new Set();
  const stack = [];

  bp.nodes.forEach((node) => {
    const typeKey = bp.getNodeTypeKey(node.nodeType);
    if (typeKey === "output" || typeKey === "setVariable") {
      keepNodeIds.add(node.id);
      stack.push(node);
    }
  });

  while (stack.length > 0) {
    const node = stack.pop();
    node.inputPorts.forEach((port) => {
      port.connections.forEach((wire) => {
        const upstreamNode = wire.startPort.node;
        if (!keepNodeIds.has(upstreamNode.id)) {
          keepNodeIds.add(upstreamNode.id);
          stack.push(upstreamNode);
        }
      });
    });
  }

  const danglingNodes = bp.nodes.filter((node) => {
    const typeKey = bp.getNodeTypeKey(node.nodeType);
    if (typeKey === "output") {
      return false;
    }
    return !keepNodeIds.has(node.id);
  });

  if (danglingNodes.length === 0) {
    return {
      ok: true,
      deletedCount: 0,
      deletedNodeIds: [],
      keptNodeIds: [...keepNodeIds],
    };
  }

  const deletedNodes = deleteNodesInternal(
    bp,
    danglingNodes.map((node) => node.id),
  );

  if (autoLayout) {
    bp.selectedNodes.clear();
    bp.nodes.forEach((node) => {
      node.isSelected = keepNodeIds.has(node.id);
      if (node.isSelected) {
        bp.selectedNodes.add(node);
      }
    });
    bp.autoArrange();
  }

  finalizeNodeChange(bp, `Delete dangling nodes (${deletedNodes.length})`);

  return {
    ok: true,
    deletedCount: deletedNodes.length,
    deletedNodeIds: deletedNodes.map((node) => node.id),
    keptNodeIds: [...keepNodeIds].filter((nodeId) =>
      bp.nodes.some((node) => node.id === nodeId),
    ),
  };
}

function normalizeUniformValue(type, value) {
  if (value === undefined) {
    return type === "color" ? { r: 1, g: 1, b: 1 } : 0;
  }

  if (type === "color") {
    if (Array.isArray(value)) {
      return {
        r: Number(value[0] ?? 0),
        g: Number(value[1] ?? 0),
        b: Number(value[2] ?? 0),
      };
    }

    if (isPlainObject(value)) {
      return {
        r: Number(value.r ?? 0),
        g: Number(value.g ?? 0),
        b: Number(value.b ?? 0),
      };
    }

    throw new Error("Color uniform value must be an RGB object or array");
  }

  return Number(value);
}

function applyPortValues(bp, node, values) {
  if (values == null) {
    return;
  }

  const entries = Array.isArray(values)
    ? values.map((value, index) => [String(index), value])
    : Object.entries(values);

  entries.forEach(([key, value]) => {
    let port = null;
    if (/^\d+$/.test(key)) {
      port = node.inputPorts[Number(key)] || null;
    } else {
      port = node.inputPorts.find((entry) => entry.name === key) || null;
    }

    assert(port, `Input port '${key}' not found on node ${node.id}`);
    assert(
      port.connections.length === 0,
      `Input port '${port.name}' is connected and cannot be edited directly`,
    );

    port.value = cloneValue(value);
  });

  node.recalculateHeight();
}

function getEditableInputValueSuggestions(node) {
  return node.inputPorts
    .filter((port) => port.isEditable && port.connections.length === 0)
    .map((port) => ({
      index: port.index,
      name: port.name,
      declaredType: port.portType,
      resolvedType: port.getResolvedType(),
      currentValue: cloneValue(port.value),
    }));
}

function maybeNormalizeGradient(bp, node, patch) {
  const hasExplicitStops = Object.prototype.hasOwnProperty.call(
    patch,
    "gradientStops",
  );
  const dataContainsStops =
    patch.data && Object.prototype.hasOwnProperty.call(patch.data, "stops");

  if (hasExplicitStops) {
    bp.ensureNodeData(node).stops = cloneValue(patch.gradientStops);
  }

  if (dataContainsStops || hasExplicitStops) {
    bp.normalizeGradientStopsForNode(node);
  }
}

function hasNodePatchChanges(patch = {}) {
  return [
    "x",
    "y",
    "position",
    "operation",
    "customInput",
    "selectedVariable",
    "data",
    "inputValues",
    "gradientStops",
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

function applyNodePatch(bp, node, patch) {
  if (patch.x !== undefined) {
    node.x = Number(patch.x);
  }

  if (patch.y !== undefined) {
    node.y = Number(patch.y);
  }

  if (patch.position) {
    if (patch.position.x !== undefined) {
      node.x = Number(patch.position.x);
    }
    if (patch.position.y !== undefined) {
      node.y = Number(patch.position.y);
    }
  }

  if (patch.operation !== undefined) {
    assert(
      node.nodeType.hasOperation,
      `Node ${node.id} does not support operations`,
    );
    node.updateOperation(patch.operation, bp);
  }

  if (patch.customInput !== undefined) {
    assert(
      node.nodeType.hasCustomInput,
      `Node ${node.id} does not support custom input`,
    );
    const nextValue = validateVariableName(bp, node, String(patch.customInput));
    node.updateCustomInput(nextValue, bp);
  }

  if (patch.selectedVariable !== undefined) {
    assert(
      node.nodeType.hasVariableDropdown,
      `Node ${node.id} does not support variable selection`,
    );
    node.selectedVariable = patch.selectedVariable;
    node.outputPorts.forEach((port) => port.updateEditability());
  }

  if (patch.data !== undefined) {
    if (isPlainObject(patch.data) && isPlainObject(node.data)) {
      node.data = {
        ...cloneValue(node.data),
        ...cloneValue(patch.data),
      };
    } else {
      node.data = cloneValue(patch.data);
    }
  }

  maybeNormalizeGradient(bp, node, patch);

  if (patch.inputValues !== undefined) {
    applyPortValues(bp, node, patch.inputValues);
  }

  node.inputPorts.forEach((port) => port.updateEditability());
  node.outputPorts.forEach((port) => port.updateEditability());
  node.recalculateHeight();
}

function syncPreviewSettings(bp, patch) {
  let shouldReload = false;
  let shouldUpdateUi = false;

  if (patch.effectTarget !== undefined) {
    const target = patch.effectTarget;
    bp.previewSettings.effectTarget = target;
    shouldUpdateUi = true;

    if (target === "sprite") {
      bp.previewSettings.object = "sprite";
    } else if (target === "shape3D" && bp.previewSettings.object === "sprite") {
      bp.previewSettings.object = "box";
    }

    if (bp.previewReady) {
      bp.sendPreviewCommand("setEffectTarget", target);
      bp.sendPreviewCommand("setObject", bp.previewSettings.object);
    }
  }

  if (patch.object !== undefined) {
    const object = patch.object;
    bp.previewSettings.object = object;
    shouldUpdateUi = true;

    if (
      object === "sprite" &&
      bp.previewSettings.effectTarget !== "sprite" &&
      bp.previewSettings.effectTarget !== "layout" &&
      bp.previewSettings.effectTarget !== "layer"
    ) {
      bp.previewSettings.effectTarget = "sprite";
      if (bp.previewReady) {
        bp.sendPreviewCommand("setEffectTarget", "sprite");
      }
    } else if (
      object !== "sprite" &&
      bp.previewSettings.effectTarget === "sprite"
    ) {
      bp.previewSettings.effectTarget = "shape3D";
      if (bp.previewReady) {
        bp.sendPreviewCommand("setEffectTarget", "shape3D");
      }
    }

    if (bp.previewReady) {
      bp.sendPreviewCommand("setObject", object);
    }
  }

  if (patch.cameraMode !== undefined) {
    bp.previewSettings.cameraMode = patch.cameraMode;
    shouldUpdateUi = true;
    if (bp.previewReady) {
      bp.sendPreviewCommand("setCameraMode", patch.cameraMode);
    }
  }

  if (patch.autoRotate !== undefined) {
    bp.previewSettings.autoRotate = !!patch.autoRotate;
    shouldUpdateUi = true;
    if (bp.previewReady) {
      bp.sendPreviewCommand("setAutoRotate", !!patch.autoRotate);
    }
  }

  if (patch.showBackgroundCube !== undefined) {
    bp.previewSettings.showBackgroundCube = !!patch.showBackgroundCube;
    shouldUpdateUi = true;
    if (bp.previewReady) {
      bp.sendPreviewCommand(
        "setShowBackgroundCube",
        !!patch.showBackgroundCube,
      );
    }
  }

  [
    ["spriteScale", "setSpriteScale"],
    ["shapeScale", "setShapeScale"],
    ["roomScale", "setRoomScale"],
    ["bgOpacity", "setBgOpacity"],
    ["bg3dOpacity", "setBg3dOpacity"],
    ["zoomLevel", "setZoomLevel"],
  ].forEach(([key, command]) => {
    if (patch[key] !== undefined) {
      bp.previewSettings[key] = Number(patch[key]);
      shouldUpdateUi = true;
      if (bp.previewReady) {
        bp.sendPreviewCommand(command, bp.previewSettings[key]);
      }
    }
  });

  if (patch.samplingMode !== undefined) {
    bp.previewSettings.samplingMode = patch.samplingMode;
    shouldReload = true;
    shouldUpdateUi = true;
  }

  if (patch.shaderLanguage !== undefined) {
    bp.previewSettings.shaderLanguage = patch.shaderLanguage;
    shouldReload = true;
    shouldUpdateUi = true;
  }

  [
    ["spriteTextureUrl", "sprite"],
    ["shapeTextureUrl", "shape"],
    ["bgTextureUrl", "bg"],
  ].forEach(([key, type]) => {
    if (patch[key] !== undefined) {
      bp.previewSettings[key] = patch[key] || null;
      shouldUpdateUi = true;
      if (patch[key]) {
        if (bp.previewReady) {
          bp.loadPreviewTexture(type, patch[key]);
        }
      } else {
        shouldReload = true;
      }
    }
  });

  if (patch.startupScript !== undefined) {
    bp.previewSettings.startupScript = String(patch.startupScript || "");
    shouldUpdateUi = true;
    if (bp.previewReady && bp.previewSettings.startupScript) {
      bp.sendStartupScript(bp.previewSettings.startupScript);
    }
  }

  if (shouldUpdateUi) {
    bp.updatePreviewSettingsUI();
  }

  if (shouldReload) {
    bp.updatePreview();
  }
}

function getPreviewNodeState(bp) {
  return {
    active: !!bp.previewNode,
    nodeId: bp.previewNode ? bp.previewNode.id : null,
  };
}

function getCanvasContainer() {
  return document.getElementById("canvas-container") || document.body;
}

function getStartupScriptInfo() {
  return {
    variables: [
      "runtime",
      "sprite",
      "shape3D",
      "background",
      "background3d",
      "camera",
      "layout",
      "layer",
    ],
    documentation:
      "https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference",
  };
}

function ensureAiStatusElements() {
  let shell = document.getElementById("ai-work-status");
  if (!shell) {
    shell = document.createElement("div");
    shell.id = "ai-work-status";
    shell.style.position = "absolute";
    shell.style.left = "16px";
    shell.style.top = "16px";
    shell.style.zIndex = "10050";
    shell.style.display = "none";
    shell.style.maxWidth = "320px";
    shell.style.padding = "10px 12px";
    shell.style.borderRadius = "10px";
    shell.style.background = "rgba(15, 18, 23, 0.92)";
    shell.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    shell.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.28)";
    shell.style.color = "#f5f7fa";
    shell.style.fontFamily = '"IBM Plex Sans", sans-serif';
    shell.style.pointerEvents = "none";

    const title = document.createElement("div");
    title.dataset.role = "title";
    title.style.fontSize = "12px";
    title.style.fontWeight = "700";
    title.style.letterSpacing = "0.08em";
    title.style.textTransform = "uppercase";
    title.style.color = "#9fd0ff";
    title.textContent = "AI working";

    const message = document.createElement("div");
    message.dataset.role = "message";
    message.style.marginTop = "4px";
    message.style.fontSize = "13px";
    message.style.lineHeight = "1.35";
    message.style.color = "rgba(255, 255, 255, 0.9)";
    message.textContent = "Starting...";

    shell.appendChild(title);
    shell.appendChild(message);
  }

  const host = getCanvasContainer();
  if (shell.parentElement !== host) {
    host.appendChild(shell);
  }

  return {
    shell,
    title: shell.querySelector('[data-role="title"]'),
    message: shell.querySelector('[data-role="message"]'),
  };
}

function getExamplesCatalog(exampleFiles) {
  return Object.keys(exampleFiles || {})
    .sort()
    .map((fileName) => {
      try {
        const data = JSON.parse(exampleFiles[fileName]);
        const shaderSettings = data.shaderSettings || {};
        const name =
          shaderSettings.name ||
          fileName
            .replace(".c3sg", "")
            .split(/[-_\s]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        return {
          id: fileName,
          fileName,
          name,
          description: shaderSettings.description || "",
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function openExampleProject(bp, exampleFiles, exampleId) {
  const raw = exampleFiles?.[exampleId];
  assert(raw, `Example '${exampleId}' not found`);

  const data = JSON.parse(raw);
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const file = new File([blob], exampleId, { type: "application/json" });
  await bp.loadFromJSON(file);
  bp.fileHandle = null;
  return data;
}

function validatePreviewNode(node) {
  const hasValidOutput = node.outputPorts.some((port) =>
    PREVIEWABLE_TYPES.has(port.getResolvedType()),
  );

  assert(
    hasValidOutput,
    `Node ${node.id} cannot be previewed because it has no float/vec2/vec3/vec4 output`,
  );
}

const API_METHOD_DESCRIPTORS = [
  {
    path: "getProjectIdentity",
    description:
      "Get the current project identity derived from shader settings.",
    mutates: false,
    args: [],
    returns: {
      type: "object",
      description: "Current project identity and shader info.",
    },
  },
  {
    path: "getManifest",
    description: "Get the machine-readable API manifest for MCP clients.",
    mutates: false,
    args: [],
    returns: {
      type: "object",
      description: "API manifest and project metadata.",
    },
  },
  {
    path: "getGuidance",
    description:
      "Get the MCP guidance content, including best practices, workflows, and domain knowledge for AI agents.",
    mutates: false,
    args: [],
    returns: {
      type: "object",
      description: "Guidance object with skill, and quickstart text.",
    },
  },
  {
    path: "runCommands",
    description: "Execute multiple API calls as one logical batch.",
    mutates: true,
    args: [
      {
        name: "input",
        type: "object",
        required: true,
        description:
          "Batch label and commands array with method and args entries.",
      },
    ],
    returns: { type: "object", description: "Batch execution results." },
  },
  {
    path: "graph.validateIR",
    description: "Validate a declarative graph IR before mutating the graph.",
    mutates: false,
    args: [
      {
        name: "ir",
        type: "object",
        required: true,
        description: "Declarative graph IR with nodes and wires.",
      },
    ],
    returns: {
      type: "object",
      description: "Validation result with structured errors.",
    },
  },
  {
    path: "graph.importIR",
    description: "Import a declarative graph IR and optionally auto-layout it.",
    mutates: true,
    args: [
      {
        name: "ir",
        type: "object",
        required: true,
        description: "Declarative graph IR with nodes and wires.",
      },
      {
        name: "options",
        type: "object",
        required: false,
        description:
          "Optional validateOnly, autoLayout, and placement settings.",
      },
    ],
    returns: {
      type: "object",
      description: "Import result with created nodes and wires.",
    },
  },
  {
    path: "graph.exportIR",
    description:
      "Export the current graph to a declarative IR for AI authoring.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Portable graph IR." },
  },
  {
    path: "graph.rewriteFanoutAsVariable",
    description:
      "Replace a fan-out output with a Set Variable and matching Get Variable nodes.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: true,
        description:
          "Target node/output and optional variable name or autoLayout behavior.",
      },
    ],
    returns: { type: "object", description: "Rewrite result summary." },
  },
  {
    path: "graph.deleteDanglingNodes",
    description:
      "Delete nodes that do not eventually feed an Output node or a Set Variable node.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional autoLayout flag for the remaining graph.",
      },
    ],
    returns: {
      type: "object",
      description: "Deleted node ids and retained sink-connected nodes.",
    },
  },
  {
    path: "session.initAIWork",
    description: "Show the in-app AI working indicator.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description:
          "Optional title/message behavior for the AI work indicator.",
      },
    ],
    returns: { type: "object", description: "Current AI work status." },
  },
  {
    path: "session.updateAIWork",
    description: "Update the in-app AI working message.",
    mutates: true,
    args: [
      {
        name: "message",
        type: "string",
        required: false,
        description: "The message shown in the AI work indicator.",
      },
    ],
    returns: { type: "object", description: "Current AI work status." },
  },
  {
    path: "session.endAIWork",
    description: "Hide the AI working indicator and show a completion toast.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Completion title, summary, and toast duration options.",
      },
    ],
    returns: { type: "object", description: "Completion status summary." },
  },
  {
    path: "projects.listExamples",
    description: "List bundled example projects.",
    mutates: false,
    args: [],
    returns: {
      type: "array",
      description: "Available example project metadata.",
    },
  },
  {
    path: "projects.openExample",
    description: "Load a bundled example project into the current tab.",
    mutates: true,
    args: [
      {
        name: "exampleId",
        type: "string",
        required: true,
        description: "The example file id returned by projects.listExamples.",
      },
    ],
    returns: {
      type: "object",
      description: "Opened example metadata and shader name.",
    },
  },
  {
    path: "projects.exportAddon",
    description:
      "Export the current shader addon, optionally updating the version first.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional version or bumpVersion export settings.",
      },
    ],
    returns: {
      type: "object",
      description: "Export result with the active version.",
    },
  },
  {
    path: "customNodes.list",
    description: "List all custom node definitions.",
    mutates: false,
    args: [],
    returns: {
      type: "array",
      description: "Serialized custom node definitions.",
    },
  },
  {
    path: "customNodes.get",
    description: "Get a custom node definition by id or key.",
    mutates: false,
    args: [
      {
        name: "customNodeIdOrKey",
        type: "string|number",
        required: true,
        description: "A custom node id or custom_<id> key.",
      },
    ],
    returns: {
      type: "object",
      description: "Serialized custom node definition.",
    },
  },
  {
    path: "ai.getWarnings",
    description: "Return AI-focused graph cleanup warnings.",
    mutates: false,
    args: [],
    returns: {
      type: "array",
      description: "Structured warning entries for the current graph.",
    },
  },
  {
    path: "ai.runDebugCheck",
    description: "Run a combined graph/code/preview health check.",
    mutates: false,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description:
          "Optional limits and screenshot settings for the debug check.",
      },
    ],
    returns: {
      type: "object",
      description:
        "Generated code status, preview errors, warnings, and optional screenshot.",
    },
  },
  {
    path: "nodes.create",
    description: "Create a node in the graph.",
    mutates: true,
    args: [
      {
        name: "input",
        type: "object",
        required: true,
        description:
          "Node type, position, optional patch data, and selection options.",
      },
    ],
    returns: { type: "object", description: "Serialized created node." },
  },
  {
    path: "nodes.delete",
    description: "Delete a non-output node and its connected wires.",
    mutates: true,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Node id to delete.",
      },
    ],
    returns: { type: "object", description: "Deletion status and node id." },
  },
  {
    path: "nodes.deleteNodes",
    description: "Delete multiple non-output nodes and their connected wires.",
    mutates: true,
    args: [
      {
        name: "nodes",
        type: "array",
        required: true,
        description: "Node ids or node objects containing id/nodeId fields.",
      },
    ],
    returns: {
      type: "object",
      description: "Deletion status, count, and deleted node ids.",
    },
  },
  {
    path: "nodes.deleteAllNodes",
    description: "Delete all non-output nodes and their connected wires.",
    mutates: true,
    args: [],
    returns: {
      type: "object",
      description: "Deletion status, count, and deleted node ids.",
    },
  },
  {
    path: "nodes.edit",
    description: "Apply a patch to an existing node.",
    mutates: true,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Node id to edit.",
      },
      {
        name: "patch",
        type: "object",
        required: true,
        description:
          "Node field updates such as position, operation, data, or input values.",
      },
    ],
    returns: { type: "object", description: "Serialized updated node." },
  },
  {
    path: "nodes.get",
    description: "Get one node by id.",
    mutates: false,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Node id to fetch.",
      },
    ],
    returns: { type: "object", description: "Serialized node." },
  },
  {
    path: "nodes.getInfo",
    description: "Get full info for one node by id.",
    mutates: false,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Node id to fetch.",
      },
    ],
    returns: { type: "object", description: "Serialized node." },
  },
  {
    path: "nodes.getPorts",
    description: "Get the input and output ports for one node.",
    mutates: false,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Node id to inspect.",
      },
    ],
    returns: { type: "object", description: "Serialized input/output ports." },
  },
  {
    path: "nodes.list",
    description: "List every node in the graph.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Node summaries." },
  },
  {
    path: "nodes.search",
    description: "Search available node types.",
    mutates: false,
    args: [
      {
        name: "query",
        type: "string",
        required: false,
        description: "Search text.",
      },
      {
        name: "options",
        type: "object",
        required: false,
        description: "Additional node type filter options.",
      },
    ],
    returns: { type: "array", description: "Matching node type summaries." },
  },
  {
    path: "nodeTypes.list",
    description: "List available node types.",
    mutates: false,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional query and availability filters.",
      },
    ],
    returns: { type: "array", description: "Available node type summaries." },
  },
  {
    path: "nodeTypes.search",
    description: "Search available node types by text.",
    mutates: false,
    args: [
      {
        name: "query",
        type: "string",
        required: false,
        description: "Search text.",
      },
      {
        name: "options",
        type: "object",
        required: false,
        description: "Additional availability filters.",
      },
    ],
    returns: { type: "array", description: "Matching node type summaries." },
  },
  {
    path: "nodeTypes.get",
    description: "Get one node type by key.",
    mutates: false,
    args: [
      {
        name: "typeKey",
        type: "string",
        required: true,
        description: "Node type key.",
      },
    ],
    returns: { type: "object", description: "Node type snapshot." },
  },
  {
    path: "ports.get",
    description: "Get a port by node reference.",
    mutates: false,
    args: [
      {
        name: "portRef",
        type: "object",
        required: true,
        description:
          "Port reference containing nodeId plus kind/type and name/index.",
      },
    ],
    returns: { type: "object", description: "Serialized port." },
  },
  {
    path: "ports.listConnections",
    description: "List wires connected to a given port.",
    mutates: false,
    args: [
      {
        name: "portRef",
        type: "object",
        required: true,
        description:
          "Port reference containing nodeId plus kind/type and name/index.",
      },
    ],
    returns: {
      type: "array",
      description: "Serialized wires attached to the port.",
    },
  },
  {
    path: "wires.create",
    description: "Create a wire from one output port to one input port.",
    mutates: true,
    args: [
      {
        name: "input",
        type: "object",
        required: true,
        description: "An object with from and to port references.",
      },
    ],
    returns: { type: "object", description: "Serialized created wire." },
  },
  {
    path: "wires.delete",
    description: "Delete a wire by id or by from/to port references.",
    mutates: true,
    args: [
      {
        name: "wireRef",
        type: "number|string|object",
        required: true,
        description: "Wire id or from/to reference object.",
      },
    ],
    returns: { type: "object", description: "Deletion status and wire id." },
  },
  {
    path: "wires.get",
    description: "Get one wire by id or by from/to port references.",
    mutates: false,
    args: [
      {
        name: "wireRef",
        type: "number|string|object",
        required: true,
        description: "Wire id or from/to reference object.",
      },
    ],
    returns: { type: "object", description: "Serialized wire." },
  },
  {
    path: "wires.getAll",
    description: "List all wires in the graph.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Wire summaries." },
  },
  {
    path: "uniforms.create",
    description: "Create a new uniform.",
    mutates: true,
    args: [
      {
        name: "input",
        type: "object",
        required: true,
        description:
          "Uniform name, type, value, description, and percent settings.",
      },
    ],
    returns: { type: "object", description: "Serialized created uniform." },
  },
  {
    path: "uniforms.createNode",
    description: "Create a graph node for an existing uniform.",
    mutates: true,
    args: [
      {
        name: "uniformId",
        type: "number",
        required: true,
        description: "Uniform id.",
      },
      {
        name: "options",
        type: "object",
        required: false,
        description: "Position and selection options for the created node.",
      },
    ],
    returns: {
      type: "object",
      description: "Serialized created uniform node.",
    },
  },
  {
    path: "uniforms.getNodeTypes",
    description: "List node types generated from current uniforms.",
    mutates: false,
    args: [],
    returns: {
      type: "array",
      description: "Uniform-backed node type snapshots.",
    },
  },
  {
    path: "uniforms.edit",
    description: "Edit an existing uniform.",
    mutates: true,
    args: [
      {
        name: "uniformId",
        type: "number",
        required: true,
        description: "Uniform id to edit.",
      },
      {
        name: "patch",
        type: "object",
        required: true,
        description: "Updated name, description, value, or percent settings.",
      },
    ],
    returns: { type: "object", description: "Serialized updated uniform." },
  },
  {
    path: "uniforms.delete",
    description: "Delete an existing uniform.",
    mutates: true,
    args: [
      {
        name: "uniformId",
        type: "number",
        required: true,
        description: "Uniform id to delete.",
      },
    ],
    returns: { type: "object", description: "Deletion status and uniform id." },
  },
  {
    path: "uniforms.reorder",
    description: "Move a uniform to a new list position.",
    mutates: true,
    args: [
      {
        name: "uniformId",
        type: "number",
        required: true,
        description: "Uniform id to move.",
      },
      {
        name: "newIndex",
        type: "number",
        required: true,
        description: "Destination index.",
      },
    ],
    returns: { type: "array", description: "Updated serialized uniform list." },
  },
  {
    path: "uniforms.get",
    description: "Get one uniform by id.",
    mutates: false,
    args: [
      {
        name: "uniformId",
        type: "number",
        required: true,
        description: "Uniform id to fetch.",
      },
    ],
    returns: { type: "object", description: "Serialized uniform." },
  },
  {
    path: "uniforms.list",
    description: "List all uniforms.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Serialized uniforms." },
  },
  {
    path: "shader.getInfo",
    description: "Get the shader metadata that identifies the current project.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Shader settings snapshot." },
  },
  {
    path: "shader.updateInfo",
    description:
      "Patch shader metadata such as name, version, author, and flags.",
    mutates: true,
    args: [
      {
        name: "patch",
        type: "object",
        required: true,
        description: "Shader settings patch.",
      },
    ],
    returns: {
      type: "object",
      description: "Updated shader settings snapshot.",
    },
  },
  {
    path: "shader.getGeneratedCode",
    description: "Generate shader code for the current graph.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Generated shaders payload." },
  },
  {
    path: "preview.getSettings",
    description: "Get current preview settings.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Preview settings snapshot." },
  },
  {
    path: "preview.getConsoleEntries",
    description: "Read preview console messages.",
    mutates: false,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional level filter and result limit.",
      },
    ],
    returns: { type: "array", description: "Preview console entries." },
  },
  {
    path: "preview.getErrors",
    description: "Read preview console errors.",
    mutates: false,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional limit for returned errors.",
      },
    ],
    returns: { type: "array", description: "Preview error entries." },
  },
  {
    path: "preview.clearConsole",
    description: "Clear preview console entries.",
    mutates: true,
    args: [],
    returns: { type: "object", description: "Clear status." },
  },
  {
    path: "preview.getStartupScriptInfo",
    description: "Return startup script helper variables and docs.",
    mutates: false,
    args: [],
    returns: {
      type: "object",
      description: "Startup script support metadata.",
    },
  },
  {
    path: "preview.updateSettings",
    description: "Patch preview settings.",
    mutates: true,
    args: [
      {
        name: "patch",
        type: "object",
        required: true,
        description: "Preview settings patch.",
      },
    ],
    returns: {
      type: "object",
      description: "Updated preview settings snapshot.",
    },
  },
  {
    path: "preview.resetSettings",
    description: "Reset preview settings to defaults.",
    mutates: true,
    args: [],
    returns: {
      type: "object",
      description: "Reset preview settings snapshot.",
    },
  },
  {
    path: "preview.getNodePreview",
    description: "Get the current node preview selection.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Preview node state." },
  },
  {
    path: "preview.setNodePreview",
    description: "Set the current previewed node or clear preview mode.",
    mutates: true,
    args: [
      {
        name: "nodeIdOrNull",
        type: "number|null",
        required: true,
        description: "Target node id or null to clear preview mode.",
      },
    ],
    returns: { type: "object", description: "Updated preview node state." },
  },
  {
    path: "preview.toggleNodePreview",
    description: "Toggle preview mode for one node.",
    mutates: true,
    args: [
      {
        name: "nodeId",
        type: "number",
        required: true,
        description: "Target node id.",
      },
    ],
    returns: { type: "object", description: "Updated preview node state." },
  },
  {
    path: "preview.screenshot",
    description: "Take a preview screenshot or trigger a download.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Set download=true to save the screenshot locally.",
      },
    ],
    returns: { type: "object", description: "Screenshot result or data URL." },
  },
  {
    path: "layout.autoArrange",
    description: "Auto-arrange the full graph or a subset of nodes.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional nodeIds array to arrange only selected nodes.",
      },
    ],
    returns: {
      type: "object",
      description: "Arrangement status and resulting camera state.",
    },
  },
  {
    path: "selection.get",
    description: "Get the current node selection.",
    mutates: false,
    args: [],
    returns: {
      type: "object",
      description: "Object with nodeIds array and count.",
    },
  },
  {
    path: "selection.clear",
    description: "Clear the current node selection.",
    mutates: true,
    args: [],
    returns: { type: "object", description: "Empty selection state." },
  },
  {
    path: "selection.set",
    description: "Replace the current selection with the given node ids.",
    mutates: true,
    args: [
      {
        name: "nodeIds",
        type: "array",
        required: true,
        description: "Array of node ids to select.",
      },
    ],
    returns: {
      type: "object",
      description: "Updated selection state with nodeIds and count.",
    },
  },
  {
    path: "selection.add",
    description: "Add nodes to the current selection.",
    mutates: true,
    args: [
      {
        name: "nodeIds",
        type: "array",
        required: true,
        description: "Array of node ids to add to selection.",
      },
    ],
    returns: {
      type: "object",
      description: "Updated selection state with nodeIds and count.",
    },
  },
  {
    path: "selection.remove",
    description: "Remove nodes from the current selection.",
    mutates: true,
    args: [
      {
        name: "nodeIds",
        type: "array",
        required: true,
        description: "Array of node ids to remove from selection.",
      },
    ],
    returns: {
      type: "object",
      description: "Updated selection state with nodeIds and count.",
    },
  },
  {
    path: "selection.fitToView",
    description:
      "Fit the camera view to the currently selected nodes. Falls back to fitting all nodes if nothing is selected.",
    mutates: true,
    args: [],
    returns: {
      type: "object",
      description: "Selection state and updated camera state.",
    },
  },
  {
    path: "camera.center",
    description: "Center the camera on the graph.",
    mutates: true,
    args: [],
    returns: { type: "object", description: "Updated camera state." },
  },
  {
    path: "camera.zoomToFit",
    description: "Zoom the camera to fit the graph.",
    mutates: true,
    args: [],
    returns: { type: "object", description: "Updated camera state." },
  },
  {
    path: "camera.setPosition",
    description: "Set the camera x/y position.",
    mutates: true,
    args: [
      {
        name: "position",
        type: "object",
        required: true,
        description: "Object with optional x and y values.",
      },
    ],
    returns: { type: "object", description: "Updated camera state." },
  },
  {
    path: "camera.setZoom",
    description: "Set the camera zoom level.",
    mutates: true,
    args: [
      {
        name: "zoom",
        type: "number",
        required: true,
        description: "New zoom level.",
      },
    ],
    returns: { type: "object", description: "Updated camera state." },
  },
  {
    path: "camera.getState",
    description: "Get the current camera state.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Camera state." },
  },
];

const API_METHOD_DESCRIPTOR_MAP = new Map(
  API_METHOD_DESCRIPTORS.map((descriptor) => [descriptor.path, descriptor]),
);

function resolveApiMethod(root, path) {
  assert(
    typeof path === "string" && path.trim(),
    "Method path must be a non-empty string",
  );

  return path.split(".").reduce((current, segment) => {
    assert(
      segment !== "__proto__" &&
        segment !== "prototype" &&
        segment !== "constructor",
      "Invalid method path segment",
    );
    return current?.[segment];
  }, root);
}

function getProjectIdentity(api) {
  const info = api.shader.getInfo();
  return {
    name: info.name || "Untitled Shader",
    version: info.version || "0.0.0.0",
    author: info.author || "",
    category: info.category || "",
    description: info.description || "",
    shaderInfo: info,
  };
}

function getApiManifest(api) {
  return {
    namespace: API_NAMESPACE,
    alias: API_ALIAS,
    version: api.version,
    project: getProjectIdentity(api),
    methods: API_METHOD_DESCRIPTORS.map((descriptor) => ({
      ...cloneValue(descriptor),
      namespace: descriptor.path.split(".")[0],
    })),
  };
}

function getMcpGuidance() {
  const skill = `# Construct Shader Graph MCP Guidance

Use this guidance when controlling Construct Shader Graph through the MCP bridge.

This document is intentionally focused on best practices, workflow, and domain knowledge. All execution should happen through MCP tools.

## Purpose

- Use MCP as the only execution surface.
- Inspect the current graph, make targeted edits, validate the result, and report progress clearly.
- Treat the graph as the source of truth for shader logic.
- Use preview tools only to inspect, debug, or visually validate the graph.

## MCP tool contract

Use these MCP tools for all work:

- \`list_projects\`
- \`select_project\`
- \`get_project_manifest\`
- \`call_project_method\`

Execution rules:

- Always begin with \`list_projects\`.
- Always choose the active project using \`shader.getInfo()\` metadata, especially \`name\` and \`version\`.
- Always use exact return values from MCP calls; never guess state.
- Always inspect the manifest if available methods, method names, or argument shapes are unclear.
- If a call returns an id, use that id for follow-up operations instead of searching by labels.

## Operating contract

- Preserve existing user work unless the task clearly requires replacing it.
- Identify the correct connected project before mutating anything.
- Inspect first, mutate second.
- Make the smallest valid change that satisfies the request.
- Verify after every structural edit such as creating nodes, deleting nodes, rewiring ports, or changing preview settings.
- Use stable ids from API results; do not rely on labels, visual position, or selection alone.
- Do not open arbitrary local files or save project files autonomously.
- Built-in examples are safe to open.
- Export is allowed because it triggers a download rather than silently overwriting a project.

## Execution priorities

1. Preserve the current graph and user intent.
2. Select the correct project.
3. Inspect graph state before editing.
4. Prefer existing nodes and helper nodes over rebuilding standard shader math.
5. Prefer small, reversible edits over large speculative rewrites.
6. Verify graph integrity and preview behavior after each important edit.
7. End with a short recap.

## Hard rules

- Always start by calling \`list_projects\`.
- If more than one project is connected, select the correct one before doing anything else.
- Always call \`session.initAIWork()\` when starting a task.
- Always call \`session.endAIWork()\` when finishing a task.
- Use \`session.updateAIWork()\` only for short phase updates.
- Always inspect preview errors after meaningful shader edits.
- Always use preview and screenshots for non-trivial visual validation.
- Prefer setting editable input port values directly before adding constant/vector nodes.
- Never assume a node id, port index, or wire id without reading it first.
- Never connect ports without checking the actual node ports.
- Never replace an output connection blindly; inspect the affected ports first.
- Never use startup scripts as a substitute for graph logic.
- Never assume renderer-specific branching is needed; the tool already generates WebGL 1, WebGL 2, and WebGPU from one graph.
- Never create or edit custom node definitions unless the user explicitly asks for advanced custom node authoring.

## Preferred workflow

Use this loop for most tasks:

1. Call \`list_projects\`.
2. Select the correct project with \`select_project\`.
3. Read \`get_project_manifest\` once per task or when capabilities are unclear.
4. Start the session.
5. Read the graph structure first (see below).
6. Identify exact node ids, port refs, uniform ids, or settings keys.
7. Apply one atomic edit or one tightly related batch.
8. Re-read the affected nodes, ports, wires, or settings.
9. Check preview or generated code if relevant.
10. Repeat only if needed.
11. End the session with a recap.

## Read the graph structure first

Before making any edits, always read the full graph structure to build a mental model of what exists.

Call \`graph.exportIR()\` at the start of every task. It returns a compact JSON representation of the entire graph including every node (with its type, operation, input values) and every wire (with human-readable port references like \`"add_3.Result"\`). This is the single cheapest call to understand the overall graph topology.

Only after reading the IR should you drill into specific nodes with \`nodes.getInfo(nodeId)\` or \`nodes.getPorts(nodeId)\`.

If the graph is non-trivial, reading the IR first prevents mistakes like:

- duplicating nodes that already exist
- wiring into the wrong port because you did not see an existing connection
- missing helper or variable nodes that already solve part of the task
- misunderstanding the signal flow through the graph

## Status update guidance

- Keep progress messages to about 4 to 10 words.
- Update only when changing phase or completing a meaningful step.
- Good examples:
  - \`"Inspecting graph"\`
  - \`"Finding output node"\`
  - \`"Adding variable nodes"\`
  - \`"Rewiring preview path"\`
  - \`"Verifying generated code"\`
- Avoid noisy or repetitive updates.

## Environment assumptions

- The graph has nodes, ports, wires, uniforms, shader settings, preview settings, and camera state.
- The tool compiles one graph to three targets: WebGL 1, WebGL 2, and WebGPU.
- The preview normally uses the \`Output\` node unless node preview is enabled.
- Project identity comes from \`shader.getInfo()\` metadata.

## Method mapping

Use \`call_project_method\` with method names from the manifest.

Examples:

- \`call_project_method({ method: "shader.getInfo", args: [] })\`
- \`call_project_method({ method: "nodes.create", args: [{ ... }] })\`
- \`call_project_method({ method: "wires.create", args: [{ ... }] })\`
- \`call_project_method({ method: "session.initAIWork", args: [{ ... }] })\`

The method names match the public API names; MCP only changes the transport.

## Safe vs side-effecting calls

Read-only calls:

- \`help\`
- \`getProjectIdentity\`
- \`getManifest\`
- \`getGuidance\`
- \`nodes.list\`
- \`nodes.get\`
- \`nodes.getInfo\`
- \`nodes.getPorts\`
- \`nodes.search\`
- \`nodeTypes.list\`
- \`nodeTypes.search\`
- \`nodeTypes.get\`
- \`ports.get\`
- \`ports.listConnections\`
- \`wires.get\`
- \`wires.getAll\`
- \`uniforms.list\`
- \`uniforms.get\`
- \`uniforms.getNodeTypes\`
- \`shader.getInfo\`
- \`shader.getGeneratedCode\`
- \`preview.getSettings\`
- \`preview.getConsoleEntries\`
- \`preview.getErrors\`
- \`preview.getNodePreview\`
- \`preview.getStartupScriptInfo\`
- \`selection.get\`
- \`camera.getState\`
- \`projects.listExamples\`
- \`customNodes.list\`
- \`customNodes.get\`
- \`ai.getWarnings\`
- \`ai.runDebugCheck\`
- \`graph.exportIR\`
- \`graph.validateIR\`

Side-effecting calls:

- \`session.initAIWork\`
- \`session.updateAIWork\`
- \`session.endAIWork\`
- \`runCommands\`
- \`nodes.create\`
- \`nodes.edit\`
- \`nodes.delete\`
- \`wires.create\`
- \`wires.delete\`
- \`uniforms.create\`
- \`uniforms.createNode\`
- \`uniforms.edit\`
- \`uniforms.reorder\`
- \`uniforms.delete\`
- \`shader.updateInfo\`
- \`preview.updateSettings\`
- \`preview.clearConsole\`
- \`preview.resetSettings\`
- \`preview.setNodePreview\`
- \`preview.toggleNodePreview\`
- \`preview.screenshot\`
- \`layout.autoArrange\`
- \`selection.clear\`
- \`selection.set\`
- \`selection.add\`
- \`selection.remove\`
- \`selection.fitToView\`
- \`camera.center\`
- \`camera.zoomToFit\`
- \`camera.setPosition\`
- \`camera.setZoom\`
- \`projects.openExample\`
- \`projects.exportAddon\`
- \`graph.importIR\`
- \`graph.rewriteFanoutAsVariable\`
- \`graph.deleteDanglingNodes\`

## Discovery guidance

When the model does not know which node type to use:

- Prefer \`nodeTypes.search(query)\` to search by concept.
- Use \`nodeTypes.list()\` only for lightweight discovery of available names/categories/tags.
- Use \`nodeTypes.get(typeKey)\` to inspect one exact type in full before creating it.
- Use \`nodes.search(query)\` as a convenience alias for node type search.
- Use \`uniforms.getNodeTypes()\` to discover generated uniform-backed node types.
- Use \`customNodes.list()\` to discover reusable custom node definitions already in the project.

Good search queries:

- \`"depth"\`
- \`"uv"\`
- \`"gradient"\`
- \`"noise"\`
- \`"premultiply"\`
- \`"light"\`

Use discovery before guessing a \`typeKey\`.

## Node and port discipline

- Always inspect ports before creating wires.
- Use explicit port refs: \`{ nodeId, kind, index }\`.
- Prefer \`index\` over \`name\` for automation stability.
- Use \`declaredType\` and \`resolvedType\` to understand generic or dynamic nodes.
- If an input port is editable and unconnected, prefer setting its value directly instead of creating a separate constant node.
- This applies to editable floats, vec2, vec3, and vec4 values when the input is intended to be a local literal.

Port reference examples:

- \`{ nodeId: 12, kind: "input", index: 0 }\`
- \`{ nodeId: 12, kind: "output", index: 1 }\`

## Editing node input values

This is one of the most important workflows.

To change a node's editable input values:

1. Read the node with \`nodes.getInfo(nodeId)\`.
2. Inspect \`editableInputValues\` to see which inputs are editable and currently unconnected.
3. Edit with \`nodes.edit(nodeId, { inputValues: ... })\`.

Rules:

- Only editable, unconnected input ports can be changed this way.
- If a port is already wired, disconnect or rewire it before editing its direct value.
- Prefer editing the input value directly when the value is local and used once.
- Prefer adding nodes or variables when the value needs to be reused elsewhere.

Example workflow:

- call \`nodes.getInfo(nodeId)\`
- inspect \`editableInputValues\`
- call \`nodes.edit(nodeId, { inputValues: { B: [0, 0, 0, 1] } })\`
- re-read the node with \`nodes.getInfo(nodeId)\`

Name-based example:

- \`nodes.edit(42, { inputValues: { B: [0, 0, 0, 1] } })\`

Index-based example:

- \`nodes.edit(42, { inputValues: { 0: 1.25 } })\`

Prefer this over adding a \`Vec4\` or \`Float\` node when the value is just a local literal used once.

## Node editing guidance

\`nodes.edit(nodeId, patch)\` is used for targeted edits to an existing node.

Common patch fields:

- \`x\`
- \`y\`
- \`position: { x, y }\`
- \`operation\`
- \`customInput\`
- \`selectedVariable\`
- \`inputValues\`
- \`gradientStops\`
- \`data\`

Examples:

- move a node: \`nodes.edit(nodeId, { position: { x: 400, y: 220 } })\`
- change an operation dropdown: \`nodes.edit(nodeId, { operation: "multiply" })\`
- rename a variable node: \`nodes.edit(nodeId, { customInput: "baseMask" })\`
- set editable inputs: \`nodes.edit(nodeId, { inputValues: { Strength: 0.5 } })\`

Do not send empty patches.

## Wires

Before wiring:

- inspect both sides with \`nodes.getPorts(nodeId)\`
- confirm output vs input direction
- confirm \`resolvedType\` compatibility

Rules:

- A wire should connect one output port to one input port.
- Reconnecting an already-connected input may replace the current connection.
- Recreating the exact same connection should be treated as idempotent.
- After wiring, verify with \`ports.listConnections(portRef)\` or \`wires.getAll()\`.

Recommended wiring loop:

1. inspect source node ports
2. inspect target node ports
3. create wire
4. re-read connections on the source or target port

## Variables

Use variable nodes to reduce wire clutter.

- \`Set Variable\` stores a computed value once.
- \`Get Variable\` reads it back in multiple places.
- The \`Get Variable\` output type is inferred from the matching \`Set Variable\` input.

Preferred rule:

- If one output would feed many distant nodes, prefer a variable instead of many long wires.
- This makes \`autoArrange()\` cleaner and keeps the graph easier to inspect.

AI-specific warning system:

- Use \`ai.getWarnings\` during verification.
- The multi-output warning only matters when one output fans out to multiple different target nodes.
- If multiple wires from one output all go into the same node, that warning does not apply.
- If it reports that an output port fans out multiple times:
  - use \`Set Variable\` and \`Get Variable\` if the value represents a larger computed tree or reusable branch
  - duplicate small local nodes if the output is just a simple leaf value and duplication is cleaner
- Treat these warnings as layout and maintainability guidance, not as compile errors.

Good variable cases:

- reused UV transforms
- reused masks
- reused sampled colors
- reused lighting terms
- any value with 3 or more downstream uses

## Selection management

Use the \`selection\` namespace to manage node selection programmatically.

- \`selection.get()\` returns current selection as \`{ nodeIds, count }\`.
- \`selection.clear()\` clears all selected nodes.
- \`selection.set(nodeIds)\` replaces the selection with the given node ids.
- \`selection.add(nodeIds)\` adds nodes to the current selection.
- \`selection.remove(nodeIds)\` removes nodes from the current selection.
- \`selection.fitToView()\` fits the camera to the currently selected nodes, or all nodes if nothing is selected.

### Showing parts of the graph to the user

The primary way to direct the user's attention to specific nodes is to select them and then fit the view to that selection. This is a two-step pattern:

1. \`selection.set(nodeIds)\` to highlight the relevant nodes.
2. \`selection.fitToView()\` to pan and zoom the camera so those nodes fill the viewport.

Use this pattern to:

- Show the user which nodes you just created or edited.
- Point out a problem area in the graph.
- Highlight the nodes involved in a particular signal path or subgraph.
- Focus on the relevant context when explaining or recapping work.

After any non-trivial edit, select the affected nodes and fit them to view so the user can immediately see what changed. This is much better than expecting the user to manually scroll and find the changes.

## Existing custom nodes

Existing custom nodes are part of the project and can be inspected and used.

- It is safe to inspect existing custom node definitions.
- It is safe to place existing custom nodes in the graph if they already exist in the project.
- Creating a new custom node definition is the advanced escape hatch and should be avoided unless the user explicitly asks for it.
- Prefer built-in nodes first, but if a project already contains a custom node designed for a task, using it is acceptable.

Inspect existing custom nodes with:

- \`customNodes.list()\`
- \`customNodes.get(id)\`
- \`nodeTypes.get("custom_<id>")\`

When a custom node already exists:

- inspect its ports and code first
- treat it like a project-specific reusable node
- understand it before placing or wiring it

## Uniform workflows

Uniform workflow usually looks like this:

1. \`uniforms.create(...)\`
2. \`uniforms.createNode(uniformId, ...)\`
3. inspect the created node with \`nodes.getPorts(nodeId)\`
4. wire it into the graph

Use uniforms for exposed user-facing values that should exist outside a single node.

Prefer direct editable input values for local literals and uniforms for reusable effect controls.

## Preview guidance

- Default preview compiles from \`Output\`.
- Node preview compiles from one selected intermediate node instead.
- Use node preview for masks, UVs, gradients, lighting terms, and intermediate color values.
- A node can only be previewed if it resolves to \`float\`, \`vec2\`, \`vec3\`, or \`vec4\` on one output.
- Use the preview console as part of the normal debug loop.
- Use screenshots to confirm that the visual result actually matches the intent.

Recommended debug loop:

1. inspect graph state
2. make one structural change or one tight batch
3. verify affected nodes and wires
4. call \`shader.getGeneratedCode\`
5. clear preview console and inspect \`preview.getErrors\`
6. use node preview for intermediate values if needed
7. take a screenshot with \`preview.screenshot\` for visual verification
8. inspect \`ai.getWarnings\` for layout and reuse issues
9. adjust and repeat only if needed

You can also use the bundled helper:

- \`ai.runDebugCheck()\`
- \`ai.runDebugCheck({ includeScreenshot: true })\`
- \`ai.runDebugCheck({ takeScreenshot: true })\`

\`ai.runDebugCheck()\` bundles:

- generated code validation
- preview error collection
- AI graph warnings
- optional screenshot capture

## Renderer guidance

- Normally build one graph and let the tool generate all targets.
- Only branch behavior when absolutely necessary.
- If renderer-specific logic is needed, prefer the shader test node.
- Use preview \`shaderLanguage\` switching to test generated targets.

## Scale-aware values

- Do not rely on tiny arbitrary constants for widths, offsets, blur radii, distortion amounts, or outline thickness.
- Prefer \`pixelSize\` for screen-space scaling.
- Prefer \`texelSize\` for texture or world-sampling offsets.
- If an effect looks too subtle or too tiny, first check whether it should be scaled by \`pixelSize\` or \`texelSize\` instead of increasing magic constants.

Rule of thumb:

- screen-relative effect -> \`pixelSize\`
- texture/sample offset effect -> \`texelSize\`

## Construct shader guidance

Construct Shader Graph is a Construct effect authoring tool, so the AI should understand a few Construct-specific ideas.

- Important shader settings include \`blendsBackground\`, \`usesDepth\`, \`crossSampling\`, \`animated\`, \`mustPredraw\`, \`supports3DDirectRendering\`, \`extendBoxH\`, and \`extendBoxV\`.
- Background sampling only makes sense when \`blendsBackground\` is enabled.
- Depth sampling only makes sense when \`usesDepth\` is enabled.
- Construct uses premultiplied alpha, so many color workflows should use \`unpremultiply\` before edits and \`premultiply\` before output.

Official references:

- \`https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects\`
- \`https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgl-shaders\`
- \`https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-effects/webgpu-shaders\`
- \`https://www.construct.net/en/make-games/manuals/construct-3/project-primitives/objects/effects\`
- \`https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/object-interfaces/ieffectinstance\`

## Prefer existing Construct helper nodes

Many common Construct shader calculations are already implemented as nodes. Prefer these over rebuilding the math manually.

- Sampling and UV nodes: \`frontUV\`, \`backUV\`, \`depthUV\`, \`textureFront\`, \`textureBack\`, \`textureDepth\`, \`samplerFront\`, \`samplerBack\`, \`samplerDepth\`, \`textureSample\`, \`textureSampleLOD\`, \`textureSampleGrad\`, \`texelFetch\`
- Built-in Construct values: \`builtinSrcStart\`, \`builtinSrcEnd\`, \`builtinSrcSize\`, \`builtinSrcCenter\`, \`builtinSrcOriginStart\`, \`builtinSrcOriginEnd\`, \`builtinSrcOriginSize\`, \`builtinSrcOriginCenter\`, \`builtinLayoutStart\`, \`builtinLayoutEnd\`, \`builtinLayoutCenter\`, \`builtinLayoutSize\`, \`builtinDestStart\`, \`builtinDestEnd\`, \`builtinDestCenter\`, \`builtinDestSize\`, \`builtinDevicePixelRatio\`, \`builtinLayerScale\`, \`builtinLayerAngle\`, \`builtinSeconds\`, \`builtinZNear\`, \`builtinZFar\`
- Coordinate helpers: \`pixelSize\`, \`texelSize\`, \`layoutPixelSize\`, \`srcOriginToNorm\`, \`srcToNorm\`, \`normToSrc\`, \`normToSrcOrigin\`, \`srcToDest\`, \`clampToSrc\`, \`clampToSrcOrigin\`, \`clampToDest\`, \`getLayoutPos\`
- Color and depth helpers: \`premultiply\`, \`unpremultiply\`, \`linearizeDepth\`, \`normalFromDepth\`, \`grayscale\`, \`rgbToHsl\`, \`hslToRgb\`
- Higher-level helpers: \`gradientMap\`, \`blendMode\`, \`directionalLight\`, \`rimLight\`, \`hemisphereLight\`, \`specularLight\`, \`matcap\`

## Startup script guidance

The startup script is optional and exists only to make preview testing easier.

- Use it for preview interactivity, not shader logic.
- Good uses: camera setup, object rotation, layout tweaks, quick runtime animation.
- Keep it short and preview-focused.
- Do not depend on it for exported shader behavior.

Available startup script variables:

- \`runtime\`
- \`sprite\`
- \`shape3D\`
- \`background\`
- \`background3d\`
- \`camera\`
- \`layout\`
- \`layer\`

Construct scripting reference:

- \`https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference\`

## Projects and session workflow

Use the session API for start, progress, and finish through \`call_project_method\`.

Project rules:

- Use \`projects.listExamples\` and \`projects.openExample\` for built-in examples.
- Do not assume the AI should open arbitrary local files.
- Do not assume the AI should save project files on its own.
- Use \`projects.exportAddon\` when the user wants a downloadable export.

## Good vs bad behavior

Good:

- Inspect ids before editing.
- Inspect ports before wiring.
- Use \`runCommands\` for a tightly related group of edits when batching helps.
- Re-read affected nodes and ports after structural changes.
- Prefer helper nodes and variable nodes.
- Reuse an existing custom node when it is clearly the project-specific tool for the job.
- Use preview errors, node preview, and screenshots as part of verification.
- Scale visible effects with \`pixelSize\` or \`texelSize\` instead of tiny magic constants.

Bad:

- Guess node ids from names.
- Rebuild a whole graph for a tiny fix.
- Create many long wires from one output when variables would do.
- Use startup scripts to simulate graph logic.
- Split the graph by renderer without a real need.
- Create new custom nodes casually instead of composing the graph from existing nodes.

## Troubleshooting

- \`No projects listed\`
  - Make sure the page is connected to the MCP bridge.
  - Re-run \`list_projects\`.
- \`Wrong project selected\`
  - Re-check \`shader.getInfo()\` metadata from the selected project.
  - Pick the correct session with \`select_project\`.
- \`Node not found\`
  - Re-run \`nodes.list\` and resolve the correct id.
- \`Unknown node type\`
  - Use \`nodeTypes.search\` or \`nodeTypes.list\` before guessing a \`typeKey\`.
  - Inspect \`nodeTypes.get(typeKey)\` before creating a node.
- \`Wire creation failed\`
  - Inspect both nodes with \`nodes.getPorts\`.
  - Check port direction and \`resolvedType\`.
- \`Generated code failed\`
  - Make sure an \`Output\` node exists.
  - Re-check required connections.
- \`Preview looks wrong\`
  - Inspect \`preview.getSettings\`.
  - Clear and inspect \`preview.getErrors\`.
  - Test node preview on intermediate values.
  - Capture a screenshot and inspect the actual visible result.
  - Switch \`shaderLanguage\` to compare targets.
- \`Graph became cluttered\`
  - Replace repeated fan-out with \`Set Variable\` and \`Get Variable\`.
  - Run \`layout.autoArrange\` after structural edits.
- \`Value is reused too many times\`
  - Inspect \`ai.getWarnings\`.
  - Use a variable for reused computed branches.
  - Duplicate tiny leaf nodes when that is simpler and cleaner.`;

  const quickstart = `# Construct Shader Graph MCP Quickstart

Use MCP tools only.

## Core loop

1. Call list_projects.
2. Select the correct project with select_project.
3. Read get_project_manifest if methods or arguments are unclear.
4. Start the task with session.initAIWork.
5. Read the graph IR with graph.exportIR() to understand the full structure before mutating.
6. Make one small edit at a time.
7. Re-read affected nodes, ports, wires, or settings.
8. Validate with shader.getGeneratedCode, preview.getErrors, and screenshots when needed.
9. Finish with session.endAIWork.

## Best practices

- Use shader.getInfo metadata to identify the right project.
- Use exact ids returned by the API.
- Inspect ports before wiring.
- Prefer editable input values before adding literal nodes.
- Use nodeTypes.search or nodeTypes.list before guessing type keys.
- Use variables when one output fans out to multiple distant places.

## Important method patterns

- Discover node types: nodeTypes.search, nodeTypes.list, nodeTypes.get
- Inspect graph: graph.exportIR for full structure, then nodes.getInfo, nodes.getPorts for details
- Edit node input values: nodes.edit(nodeId, { inputValues: { PortName: value } })
- Wire nodes: wires.create({ from, to }) after inspecting both ports
- Manage selection: selection.get, selection.set, selection.clear, selection.add, selection.remove, selection.fitToView
- Show nodes to user: selection.set(nodeIds) then selection.fitToView() to highlight and focus
- Validate: ai.runDebugCheck({ includeScreenshot: true })`;

  return { skill, quickstart };
}

export function installGlobalConsoleApi(blueprint, helpers = {}) {
  assignMissingWireIds(blueprint);
  const { Wire: WireClass, exampleFiles } = helpers;
  blueprint.WireClass = WireClass;

  const originalPushState = blueprint.history.pushState.bind(blueprint.history);
  const batchState = {
    active: false,
    dirty: false,
  };

  blueprint.history.pushState = (...args) => {
    if (batchState.active) {
      batchState.dirty = true;
      return;
    }

    return originalPushState(...args);
  };

  const api = {
    version: API_VERSION,

    help() {
      return {
        namespace: API_NAMESPACE,
        alias: API_ALIAS,
        methods: [
          "session",
          "projects",
          "customNodes",
          "ai",
          "graph",
          "nodes",
          "nodeTypes",
          "ports",
          "wires",
          "uniforms",
          "shader",
          "preview",
          "layout",
          "selection",
          "camera",
          "batch",
          "getProjectIdentity",
          "getManifest",
          "getGuidance",
          "call",
          "runCommands",
        ],
      };
    },

    getProjectIdentity() {
      return getProjectIdentity(api);
    },

    getManifest() {
      return getApiManifest(api);
    },

    getGuidance() {
      return getMcpGuidance();
    },

    call(methodPath, args = []) {
      const descriptor = API_METHOD_DESCRIPTOR_MAP.get(methodPath);
      assert(descriptor, `Unknown API method '${methodPath}'`);

      const fn = resolveApiMethod(api, methodPath);
      assert(
        typeof fn === "function",
        `Method '${methodPath}' is not callable`,
      );

      const inputArgs = Array.isArray(args) ? args : [args];
      return fn(...inputArgs);
    },

    async runCommands({ label = "API command batch", commands = [] } = {}) {
      assertPlainObject(
        arguments[0] ?? {},
        "runCommands requires an input object",
      );
      if (label !== undefined) {
        assert(typeof label === "string", "runCommands label must be a string");
      }
      assert(Array.isArray(commands), "runCommands requires a commands array");

      return api.batch(label, async () => {
        const results = [];
        const refs = {};

        const resolveArgRefs = (value) => {
          if (Array.isArray(value)) {
            return value.map((entry) => resolveArgRefs(entry));
          }
          if (!value || typeof value !== "object") {
            return value;
          }
          if (Object.prototype.hasOwnProperty.call(value, "$ref")) {
            const refPath = String(value.$ref || "").trim();
            assert(refPath, "Command $ref path cannot be empty");
            const [refName, ...segments] = refPath.split(".");
            assert(
              refs[refName] !== undefined,
              `Unknown command ref '${refName}'`,
            );
            return segments.reduce(
              (current, segment) => current?.[segment],
              refs[refName],
            );
          }

          return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
              key,
              resolveArgRefs(entry),
            ]),
          );
        };

        for (const [index, command] of commands.entries()) {
          assert(
            command && typeof command === "object",
            `Command at index ${index} must be an object`,
          );
          assertNonEmptyString(
            command.method,
            `Command at index ${index} is missing a method`,
          );
          if (command.args !== undefined) {
            assert(
              Array.isArray(command.args),
              `Command '${command.method}' args must be an array`,
            );
          }
          if (command.ref !== undefined) {
            assertNonEmptyString(
              command.ref,
              `Command '${command.method}' ref must be a non-empty string`,
            );
          }

          const resolvedArgs = resolveArgRefs(command.args || []);
          const result = await api.call(command.method, resolvedArgs);
          if (command.ref) {
            refs[command.ref] = result;
          }
          results.push({
            index,
            method: command.method,
            ref: command.ref || null,
            result,
          });
        }

        return {
          ok: true,
          label,
          refs,
          results,
        };
      });
    },

    session: {
      initAIWork(options = {}) {
        assertOptionalPlainObject(
          options,
          "session.initAIWork options must be an object",
        );
        assertOptionalString(
          options.title,
          "session.initAIWork title must be a string",
        );
        assertOptionalString(
          options.message,
          "session.initAIWork message must be a string",
        );
        assertOptionalBoolean(
          options.closeStartupDialog,
          "session.initAIWork closeStartupDialog must be a boolean",
        );

        const status = ensureAiStatusElements();
        const modal = document.getElementById("openFilesModal");
        if (modal && options.closeStartupDialog !== false) {
          modal.style.display = "none";
        }

        status.title.textContent = options.title?.trim() || "AI working";
        status.message.textContent = String(options.message || "Working...");
        status.shell.style.display = "block";

        return {
          active: true,
          message: status.message.textContent,
        };
      },

      updateAIWork(message) {
        assert(
          typeof message === "string" || message === undefined,
          "session.updateAIWork message must be a string",
        );
        const status = ensureAiStatusElements();
        status.message.textContent = String(message || "Working...");
        status.shell.style.display = "block";
        return {
          active: true,
          message: status.message.textContent,
        };
      },

      endAIWork(options = {}) {
        assertOptionalPlainObject(
          options,
          "session.endAIWork options must be an object",
        );
        assertOptionalString(
          options.title,
          "session.endAIWork title must be a string",
        );
        assertOptionalStringOrArray(
          options.summary,
          "session.endAIWork summary must be a string or array",
        );
        assertOptionalFiniteNumber(
          options.duration,
          "session.endAIWork duration must be a finite number",
        );

        const status = ensureAiStatusElements();
        status.shell.style.display = "none";

        const summary = normalizeSummaryLines(options.summary);
        blueprint.showNotification({
          type: "success",
          title: options.title || "AI task complete",
          message: summary.join(" | "),
          duration: options.duration || 7000,
        });

        return {
          active: false,
          title: options.title || "AI task complete",
          summary,
        };
      },
    },

    projects: {
      listExamples() {
        return getExamplesCatalog(exampleFiles);
      },

      async openExample(exampleId) {
        assertNonEmptyString(
          exampleId,
          "projects.openExample requires a non-empty example id string",
        );
        const data = await openExampleProject(
          blueprint,
          exampleFiles,
          exampleId,
        );
        const modal = document.getElementById("openFilesModal");
        if (modal) {
          modal.style.display = "none";
        }

        const entry = getExamplesCatalog(exampleFiles).find(
          (item) => item.id === exampleId,
        );

        return {
          ok: true,
          example: entry,
          shaderName: data.shaderSettings?.name || null,
        };
      },

      exportAddon(options = {}) {
        assertOptionalPlainObject(
          options,
          "projects.exportAddon options must be an object",
        );
        if (options.version !== undefined) {
          options.version = validateVersionString(options.version);
        }
        if (options.bumpVersion !== undefined) {
          options.bumpVersion = validateBumpVersion(options.bumpVersion);
        }
        assert(
          !(options.version !== undefined && options.bumpVersion !== undefined),
          "projects.exportAddon accepts either version or bumpVersion, not both",
        );

        if (options.version) {
          blueprint.shaderSettings.version = options.version;
          blueprint.updateShaderSettingsUI();
          blueprint.exportGLSL();
        } else if (options.bumpVersion) {
          blueprint.bumpVersionAndExport(options.bumpVersion);
        } else {
          blueprint.exportGLSL();
        }

        return {
          ok: true,
          version: blueprint.shaderSettings.version,
        };
      },
    },

    customNodes: {
      list() {
        return blueprint.customNodes.map((customNode) =>
          serializeCustomNodeDefinition(customNode),
        );
      },

      get(customNodeIdOrKey) {
        assert(
          typeof customNodeIdOrKey === "string" ||
            typeof customNodeIdOrKey === "number",
          "customNodes.get requires a custom node id or custom_<id> key",
        );
        const customNodeId = String(customNodeIdOrKey).startsWith("custom_")
          ? Number(String(customNodeIdOrKey).replace("custom_", ""))
          : Number(customNodeIdOrKey);
        assert(
          Number.isInteger(customNodeId),
          `Invalid custom node reference '${customNodeIdOrKey}'`,
        );
        const customNode = blueprint.customNodes.find(
          (entry) => entry.id === customNodeId,
        );
        assert(customNode, `Custom node ${customNodeIdOrKey} not found`);
        return serializeCustomNodeDefinition(customNode);
      },
    },

    ai: {
      getWarnings() {
        return getAiWarnings(blueprint);
      },

      async runDebugCheck(options = {}) {
        assertOptionalPlainObject(
          options,
          "ai.runDebugCheck options must be an object",
        );
        assertOptionalFiniteNumber(
          options.previewErrorLimit,
          "ai.runDebugCheck previewErrorLimit must be a finite number",
        );
        assertOptionalBoolean(
          options.includeScreenshot,
          "ai.runDebugCheck includeScreenshot must be a boolean",
        );
        assertOptionalBoolean(
          options.takeScreenshot,
          "ai.runDebugCheck takeScreenshot must be a boolean",
        );
        return runAiDebugCheck(blueprint, api, options);
      },
    },

    graph: {
      validateIR(ir) {
        if (typeof blueprint.validateGraphIR === "function") {
          return blueprint.validateGraphIR(ir);
        }
        return validateGraphIR(blueprint, ir);
      },

      importIR(ir, options = {}) {
        assertPlainObject(ir, "graph.importIR requires an IR object");
        assertOptionalPlainObject(
          options,
          "graph.importIR options must be an object",
        );
        if (options.position !== undefined) {
          assertPlainObject(
            options.position,
            "graph.importIR position must be an object",
          );
          assertOptionalFiniteNumber(
            options.position.x,
            "graph.importIR position.x must be a finite number",
          );
          assertOptionalFiniteNumber(
            options.position.y,
            "graph.importIR position.y must be a finite number",
          );
        }
        assertOptionalBoolean(
          options.validateOnly,
          "graph.importIR validateOnly must be a boolean",
        );
        assertOptionalBoolean(
          options.autoLayout,
          "graph.importIR autoLayout must be a boolean",
        );
        assertOptionalString(
          options.historyLabel,
          "graph.importIR historyLabel must be a string",
        );
        if (typeof blueprint.importGraphIR === "function") {
          return blueprint.importGraphIR(ir, options);
        }
        return importGraphIR(blueprint, ir, options);
      },

      exportIR() {
        if (typeof blueprint.exportGraphIR === "function") {
          return blueprint.exportGraphIR();
        }
        return exportGraphIR(blueprint);
      },

      rewriteFanoutAsVariable(options = {}) {
        assertPlainObject(
          options,
          "graph.rewriteFanoutAsVariable requires an options object",
        );
        assertOptionalFiniteNumber(
          options.outputIndex,
          "graph.rewriteFanoutAsVariable outputIndex must be a finite number",
        );
        assertOptionalString(
          options.outputName,
          "graph.rewriteFanoutAsVariable outputName must be a string",
        );
        assertOptionalString(
          options.variableName,
          "graph.rewriteFanoutAsVariable variableName must be a string",
        );
        assertOptionalBoolean(
          options.autoLayout,
          "graph.rewriteFanoutAsVariable autoLayout must be a boolean",
        );
        if (typeof blueprint.rewriteFanoutAsVariable === "function") {
          return blueprint.rewriteFanoutAsVariable(options);
        }
        return rewriteFanoutAsVariable(blueprint, options);
      },

      deleteDanglingNodes(options = {}) {
        assertOptionalPlainObject(
          options,
          "graph.deleteDanglingNodes options must be an object",
        );
        assertOptionalBoolean(
          options.autoLayout,
          "graph.deleteDanglingNodes autoLayout must be a boolean",
        );
        if (typeof blueprint.deleteDanglingNodes === "function") {
          return blueprint.deleteDanglingNodes(options);
        }
        return deleteDanglingNodes(blueprint, options);
      },
    },

    batch(label, fn) {
      assert(typeof fn === "function", "batch(label, fn) requires a function");

      batchState.active = true;
      batchState.dirty = false;

      const completeBatch = () => {
        if (batchState.dirty) {
          originalPushState(label || "Console batch");
        }
        batchState.active = false;
        batchState.dirty = false;
      };

      try {
        const result = fn(api);

        if (result && typeof result.then === "function") {
          return result.finally(() => {
            completeBatch();
          });
        }

        completeBatch();
        return result;
      } catch (error) {
        completeBatch();
        throw error;
      }
    },

    nodes: {
      create(input = {}) {
        assertPlainObject(input, "nodes.create requires an input object");
        const typeKey = input.typeKey || input.type;
        assertNonEmptyString(
          typeKey,
          "nodes.create requires a non-empty type or typeKey string",
        );
        assertOptionalFiniteNumber(
          input.x,
          "nodes.create x must be a finite number",
        );
        assertOptionalFiniteNumber(
          input.y,
          "nodes.create y must be a finite number",
        );
        assertOptionalPlainObject(
          input.position,
          "nodes.create position must be an object",
        );
        if (input.position) {
          assertOptionalFiniteNumber(
            input.position.x,
            "nodes.create position.x must be a finite number",
          );
          assertOptionalFiniteNumber(
            input.position.y,
            "nodes.create position.y must be a finite number",
          );
        }
        assertOptionalPlainObject(
          input.patch,
          "nodes.create patch must be an object",
        );
        assertOptionalString(
          input.operation,
          "nodes.create operation must be a string",
        );
        assertOptionalString(
          input.customInput,
          "nodes.create customInput must be a string",
        );
        assertOptionalString(
          input.selectedVariable,
          "nodes.create selectedVariable must be a string",
        );
        assertOptionalBoolean(
          input.select,
          "nodes.create select must be a boolean",
        );

        if (typeKey === "output") {
          assert(
            !blueprint.nodes.some(
              (node) => blueprint.getNodeTypeKey(node.nodeType) === "output",
            ),
            "Only one Output node can exist",
          );
        }

        const nodeType = blueprint.getNodeTypeFromKey(typeKey);
        assert(nodeType, `Unknown node type '${typeKey}'`);

        const fallbackPosition = worldCenter(blueprint);
        let node;

        if (typeKey.startsWith("uniform_")) {
          const uniformId = Number(typeKey.replace("uniform_", ""));
          const uniform = getUniformById(blueprint, uniformId);
          node = blueprint.createUniformNode(
            uniform,
            input.x ?? input.position?.x ?? fallbackPosition.x,
            input.y ?? input.position?.y ?? fallbackPosition.y,
          );
        } else {
          node = blueprint.addNode(
            input.x ?? input.position?.x ?? fallbackPosition.x,
            input.y ?? input.position?.y ?? fallbackPosition.y,
            nodeType,
          );
          blueprint.updateDependencyList();
          blueprint.onShaderChanged();
        }

        assignMissingWireIds(blueprint);

        if (input.patch) {
          applyNodePatch(blueprint, node, input.patch);
        }

        if (input.operation !== undefined) {
          applyNodePatch(blueprint, node, { operation: input.operation });
        }

        if (input.customInput !== undefined) {
          applyNodePatch(blueprint, node, { customInput: input.customInput });
        }

        if (input.selectedVariable !== undefined) {
          applyNodePatch(blueprint, node, {
            selectedVariable: input.selectedVariable,
          });
        }

        if (input.inputValues !== undefined) {
          applyNodePatch(blueprint, node, { inputValues: input.inputValues });
        }

        if (input.gradientStops !== undefined) {
          applyNodePatch(blueprint, node, {
            gradientStops: input.gradientStops,
          });
        }

        if (input.select) {
          blueprint.clearSelection();
          blueprint.selectNode(node, false);
        }

        pushHistory(blueprint, `Create node (${node.title})`);
        return serializeNode(blueprint, node);
      },

      delete(nodeId) {
        assert(
          Number.isInteger(Number(nodeId)),
          "nodes.delete requires a valid node id",
        );
        const [node] = deleteNodesInternal(blueprint, [nodeId]);
        finalizeNodeChange(blueprint, `Delete node (${node.title})`);
        return { ok: true, nodeId: node.id };
      },

      deleteNodes(nodes) {
        assert(
          Array.isArray(nodes),
          "nodes.deleteNodes requires an array of node references",
        );
        const deletedNodes = deleteNodesInternal(blueprint, nodes);
        const deletedNodeIds = deletedNodes.map((node) => node.id);
        finalizeNodeChange(
          blueprint,
          `Delete ${deletedNodes.length} node${deletedNodes.length === 1 ? "" : "s"}`,
        );
        return {
          ok: true,
          count: deletedNodes.length,
          nodeIds: deletedNodeIds,
        };
      },

      deleteAllNodes() {
        const nodesToDelete = blueprint.nodes.filter(
          (node) => blueprint.getNodeTypeKey(node.nodeType) !== "output",
        );
        if (!nodesToDelete.length) {
          return { ok: true, count: 0, nodeIds: [] };
        }

        const deletedNodes = deleteNodesInternal(
          blueprint,
          nodesToDelete.map((node) => node.id),
        );
        const deletedNodeIds = deletedNodes.map((node) => node.id);
        finalizeNodeChange(
          blueprint,
          `Delete all nodes (${deletedNodes.length})`,
        );
        return {
          ok: true,
          count: deletedNodes.length,
          nodeIds: deletedNodeIds,
        };
      },

      edit(nodeId, patch = {}) {
        assert(
          Number.isInteger(Number(nodeId)),
          "nodes.edit requires a valid node id",
        );
        assertPlainObject(patch, "nodes.edit patch must be an object");
        const node = getNodeById(blueprint, nodeId);
        assert(
          hasNodePatchChanges(patch),
          `No supported patch fields provided for node ${nodeId}`,
        );
        applyNodePatch(blueprint, node, patch);
        finalizeNodeChange(blueprint, `Edit node (${node.title})`);
        return serializeNode(blueprint, node);
      },

      get(nodeId) {
        assert(
          Number.isInteger(Number(nodeId)),
          "nodes.get requires a valid node id",
        );
        return serializeNodeSummary(blueprint, getNodeById(blueprint, nodeId));
      },

      getInfo(nodeId) {
        assert(
          Number.isInteger(Number(nodeId)),
          "nodes.getInfo requires a valid node id",
        );
        return serializeNode(blueprint, getNodeById(blueprint, nodeId));
      },

      getPorts(nodeId) {
        assert(
          Number.isInteger(Number(nodeId)),
          "nodes.getPorts requires a valid node id",
        );
        const node = getNodeById(blueprint, nodeId);
        return {
          inputs: node.inputPorts.map((port) => serializePort(blueprint, port)),
          outputs: node.outputPorts.map((port) =>
            serializePort(blueprint, port),
          ),
        };
      },

      list() {
        return blueprint.nodes.map((node) =>
          serializeNodeSummary(blueprint, node),
        );
      },

      search(query = "", options = {}) {
        assert(
          typeof query === "string",
          "nodes.search query must be a string",
        );
        assertOptionalPlainObject(
          options,
          "nodes.search options must be an object",
        );
        return api.nodeTypes.search(query, options);
      },
    },

    nodeTypes: {
      list(options = {}) {
        assertOptionalPlainObject(
          options,
          "nodeTypes.list options must be an object",
        );
        assertOptionalBoolean(
          options.availableOnly,
          "nodeTypes.list availableOnly must be a boolean",
        );
        assertOptionalString(
          options.query,
          "nodeTypes.list query must be a string",
        );
        const types = options.availableOnly
          ? blueprint
              .getFilteredNodeTypes()
              .map(([key, nodeType]) => serializeNodeTypeSummary(nodeType, key))
          : getAllNodeTypes(blueprint);
        return filterNodeTypes(types, options.query || "");
      },

      search(query = "", options = {}) {
        assert(
          typeof query === "string",
          "nodeTypes.search query must be a string",
        );
        assertOptionalPlainObject(
          options,
          "nodeTypes.search options must be an object",
        );
        return api.nodeTypes.list({ ...options, query });
      },

      get(typeKey) {
        assertNonEmptyString(
          typeKey,
          "nodeTypes.get requires a non-empty type key string",
        );
        const nodeType = blueprint.getNodeTypeFromKey(typeKey);
        assert(nodeType, `Unknown node type '${typeKey}'`);
        return normalizeTypeSnapshot(nodeType, typeKey);
      },
    },

    ports: {
      get(portRef) {
        return serializePort(blueprint, resolvePortRef(blueprint, portRef));
      },

      listConnections(portRef) {
        const port = resolvePortRef(blueprint, portRef);
        return port.connections.map((wire) => serializeWire(blueprint, wire));
      },
    },

    wires: {
      create({ from, to }) {
        assertPlainObject(
          arguments[0],
          "wires.create requires an object with from and to port refs",
        );
        const startPort = resolvePortRef(blueprint, from, "output");
        const endPort = resolvePortRef(blueprint, to, "input");

        assert(
          startPort.canConnectTo(endPort),
          buildPortTypeErrorMessage(startPort, endPort),
        );

        const existingWire = blueprint.wires.find(
          (wire) => wire.startPort === startPort && wire.endPort === endPort,
        );
        if (existingWire) {
          return serializeWire(blueprint, existingWire);
        }

        if (endPort.connections.length > 0) {
          blueprint.disconnectWire(endPort.connections[0]);
        }

        assert(WireClass, "Wire helper is not available");
        const wire = new WireClass(startPort, endPort);
        getWireId(blueprint, wire);
        blueprint.wires.push(wire);
        startPort.connections.push(wire);
        endPort.connections.push(wire);
        blueprint.resolveGenericsForConnection(startPort, endPort);
        endPort.updateEditability();
        blueprint.nodes.forEach((node) => {
          node.inputPorts.forEach((port) => port.updateEditability());
          node.recalculateHeight();
        });

        finalizeNodeChange(blueprint, "Create wire");
        return serializeWire(blueprint, wire);
      },

      delete(wireRef) {
        assert(
          wireRef !== undefined,
          "wires.delete requires a wire id or from/to reference",
        );
        const wire = getWireByRef(blueprint, wireRef);
        const wireId = getWireId(blueprint, wire);
        blueprint.disconnectWire(wire);
        blueprint.render();
        blueprint.updateDependencyList();
        pushHistory(blueprint, "Delete wire");
        return { ok: true, wireId };
      },

      get(wireRef) {
        assert(
          wireRef !== undefined,
          "wires.get requires a wire id or from/to reference",
        );
        return serializeWire(blueprint, getWireByRef(blueprint, wireRef));
      },

      getAll() {
        return blueprint.wires.map((wire) =>
          serializeWireSummary(blueprint, wire),
        );
      },
    },

    uniforms: {
      create(input = {}) {
        assertPlainObject(input, "uniforms.create requires an input object");
        const name = String(input.name || "").trim();
        assert(name, "uniforms.create requires a name");
        assertOptionalString(
          input.description,
          "uniforms.create description must be a string",
        );
        assertOptionalBoolean(
          input.isPercent,
          "uniforms.create isPercent must be a boolean",
        );

        const type = input.type || "float";
        assert(
          type === "float" || type === "color",
          "Uniform type must be 'float' or 'color'",
        );

        let variableName = `uniform_${blueprint.sanitizeVariableName(name)}`;
        let counter = 1;
        const baseVariableName = variableName;
        while (
          blueprint.uniforms.some(
            (entry) => entry.variableName === variableName,
          ) ||
          blueprint.uniforms.some((entry) => entry.name === variableName)
        ) {
          variableName = `${baseVariableName}_${counter}`;
          counter++;
        }

        const uniform = {
          id: blueprint.uniformIdCounter++,
          name,
          variableName,
          description: String(input.description || ""),
          type,
          value: normalizeUniformValue(type, input.value),
          isPercent: !!input.isPercent,
        };

        blueprint.uniforms.push(uniform);
        blueprint.renderUniformList();
        blueprint.onShaderChanged();
        pushHistory(blueprint, `Create uniform (${uniform.name})`);
        return serializeUniform(uniform, blueprint.uniforms.length - 1);
      },

      createNode(uniformId, options = {}) {
        assert(
          Number.isInteger(Number(uniformId)),
          "uniforms.createNode requires a valid uniform id",
        );
        assertOptionalPlainObject(
          options,
          "uniforms.createNode options must be an object",
        );
        assertOptionalFiniteNumber(
          options.x,
          "uniforms.createNode x must be a finite number",
        );
        assertOptionalFiniteNumber(
          options.y,
          "uniforms.createNode y must be a finite number",
        );
        assertOptionalPlainObject(
          options.position,
          "uniforms.createNode position must be an object",
        );
        if (options.position) {
          assertOptionalFiniteNumber(
            options.position.x,
            "uniforms.createNode position.x must be a finite number",
          );
          assertOptionalFiniteNumber(
            options.position.y,
            "uniforms.createNode position.y must be a finite number",
          );
        }
        assertOptionalBoolean(
          options.select,
          "uniforms.createNode select must be a boolean",
        );
        const uniform = getUniformById(blueprint, uniformId);
        const fallbackPosition = worldCenter(blueprint);
        const node = blueprint.createUniformNode(
          uniform,
          options.x ?? options.position?.x ?? fallbackPosition.x,
          options.y ?? options.position?.y ?? fallbackPosition.y,
        );

        if (options.select) {
          blueprint.clearSelection();
          blueprint.selectNode(node, false);
        }

        pushHistory(blueprint, `Create uniform node (${uniform.name})`);
        return serializeNode(blueprint, node);
      },

      getNodeTypes() {
        return Object.entries(blueprint.getUniformNodeTypes()).map(
          ([key, nodeType]) => normalizeTypeSnapshot(nodeType, key),
        );
      },

      edit(uniformId, patch = {}) {
        assert(
          Number.isInteger(Number(uniformId)),
          "uniforms.edit requires a valid uniform id",
        );
        assertPlainObject(patch, "uniforms.edit patch must be an object");
        const uniform = getUniformById(blueprint, uniformId);
        const oldVariableName = uniform.variableName;

        if (patch.name !== undefined) {
          const newName = String(patch.name).trim();
          assert(newName, "Uniform name cannot be empty");
          uniform.name = newName;

          let nextVariableName = `uniform_${blueprint.sanitizeVariableName(newName)}`;
          let counter = 1;
          const baseVariableName = nextVariableName;
          while (
            blueprint.uniforms.some(
              (entry) =>
                entry.id !== uniform.id &&
                entry.variableName === nextVariableName,
            ) ||
            blueprint.uniforms.some(
              (entry) =>
                entry.id !== uniform.id && entry.name === nextVariableName,
            )
          ) {
            nextVariableName = `${baseVariableName}_${counter}`;
            counter++;
          }

          uniform.variableName = nextVariableName;
          blueprint.updateUniformNodeNames(oldVariableName, nextVariableName);
        }

        if (patch.description !== undefined) {
          uniform.description = String(patch.description || "");
        }

        if (patch.value !== undefined) {
          uniform.value = normalizeUniformValue(uniform.type, patch.value);
        }

        if (patch.isPercent !== undefined) {
          uniform.isPercent = !!patch.isPercent;
        }

        blueprint.renderUniformList();
        blueprint.onShaderChanged();
        if (patch.value !== undefined) {
          blueprint.sendUniformValuesToPreview();
        }
        pushHistory(blueprint, `Edit uniform (${uniform.name})`);
        return serializeUniform(
          uniform,
          blueprint.uniforms.findIndex((entry) => entry.id === uniform.id),
        );
      },

      delete(uniformId) {
        assert(
          Number.isInteger(Number(uniformId)),
          "uniforms.delete requires a valid uniform id",
        );
        const uniform = getUniformById(blueprint, uniformId);
        blueprint.deleteUniform(uniform.id);
        return { ok: true, uniformId: uniform.id };
      },

      reorder(uniformId, newIndex) {
        assert(
          Number.isInteger(Number(uniformId)),
          "uniforms.reorder requires a valid uniform id",
        );
        assertFiniteNumber(
          newIndex,
          "uniforms.reorder newIndex must be a finite number",
        );
        const index = blueprint.uniforms.findIndex(
          (entry) => entry.id === Number(uniformId),
        );
        assert(index >= 0, `Uniform ${uniformId} not found`);

        const targetIndex = Math.max(
          0,
          Math.min(Number(newIndex), blueprint.uniforms.length - 1),
        );
        const [uniform] = blueprint.uniforms.splice(index, 1);
        blueprint.uniforms.splice(targetIndex, 0, uniform);
        blueprint.renderUniformList();
        blueprint.onShaderChanged();
        blueprint.sendUniformValuesToPreview();
        pushHistory(blueprint, `Reorder uniform (${uniform.name})`);
        return blueprint.uniforms.map((entry, position) =>
          serializeUniform(entry, position),
        );
      },

      get(uniformId) {
        assert(
          Number.isInteger(Number(uniformId)),
          "uniforms.get requires a valid uniform id",
        );
        const uniform = getUniformById(blueprint, uniformId);
        return serializeUniform(
          uniform,
          blueprint.uniforms.findIndex((entry) => entry.id === uniform.id),
        );
      },

      list() {
        return blueprint.uniforms.map((uniform, index) =>
          serializeUniform(uniform, index),
        );
      },
    },

    shader: {
      getInfo() {
        return cloneValue(blueprint.shaderSettings);
      },

      updateInfo(patch = {}) {
        assertPlainObject(patch, "shader.updateInfo patch must be an object");
        Object.keys(patch).forEach((key) => {
          assert(
            Object.prototype.hasOwnProperty.call(blueprint.shaderSettings, key),
            `Unknown shader setting '${key}'`,
          );
          if (key === "version") {
            patch[key] = validateVersionString(patch[key]);
          }
          blueprint.shaderSettings[key] = cloneValue(patch[key]);
        });

        blueprint.updateShaderSettingsUI();
        blueprint.onShaderChanged();
        pushHistory(blueprint, "Edit shader settings");
        return cloneValue(blueprint.shaderSettings);
      },

      getGeneratedCode() {
        const shaders = blueprint.generateAllShaders();
        assert(
          shaders,
          "Failed to generate shaders. Make sure the graph has an Output node and valid connections.",
        );
        return shaders;
      },
    },

    preview: {
      getSettings() {
        return cloneValue(blueprint.previewSettings);
      },

      getConsoleEntries(options = {}) {
        assertOptionalPlainObject(
          options,
          "preview.getConsoleEntries options must be an object",
        );
        if (options.level !== undefined) {
          if (Array.isArray(options.level)) {
            options.level.forEach((level) => {
              assert(
                typeof level === "string",
                "preview.getConsoleEntries level entries must be strings",
              );
            });
          } else {
            assert(
              typeof options.level === "string",
              "preview.getConsoleEntries level must be a string or array of strings",
            );
          }
        }
        assertOptionalFiniteNumber(
          options.limit,
          "preview.getConsoleEntries limit must be a finite number",
        );

        let entries = blueprint.consoleEntries.map((entry) =>
          serializePreviewConsoleEntry(entry),
        );

        if (options.level) {
          const allowedLevels = Array.isArray(options.level)
            ? new Set(options.level)
            : new Set([options.level]);
          entries = entries.filter((entry) => allowedLevels.has(entry.level));
        }

        if (options.limit !== undefined) {
          const limit = Math.max(0, Number(options.limit));
          entries = entries.slice(-limit);
        }

        return entries;
      },

      getErrors(options = {}) {
        assertOptionalPlainObject(
          options,
          "preview.getErrors options must be an object",
        );
        return api.preview.getConsoleEntries({ ...options, level: "error" });
      },

      clearConsole() {
        blueprint.clearPreviewConsole();
        return { ok: true };
      },

      getStartupScriptInfo() {
        return getStartupScriptInfo();
      },

      updateSettings(patch = {}) {
        assertPlainObject(
          patch,
          "preview.updateSettings patch must be an object",
        );
        Object.keys(patch).forEach((key) => {
          assert(
            PREVIEW_SETTING_KEYS.has(key),
            `Unknown preview setting '${key}'`,
          );
        });

        assertOptionalOneOf(
          patch.effectTarget,
          ["sprite", "shape3D", "layout", "layer"],
          "preview.updateSettings effectTarget must be one of sprite, shape3D, layout, or layer",
        );
        assertOptionalOneOf(
          patch.object,
          [
            "sprite",
            "box",
            "sphere",
            "cylinder",
            "capsule",
            "cone",
            "torus",
            "plane",
          ],
          "preview.updateSettings object must be a supported preview object",
        );
        assertOptionalOneOf(
          patch.cameraMode,
          ["2d", "perspective", "orthographic"],
          "preview.updateSettings cameraMode must be 2d, perspective, or orthographic",
        );
        assertOptionalOneOf(
          patch.samplingMode,
          ["trilinear", "bilinear", "nearest"],
          "preview.updateSettings samplingMode must be trilinear, bilinear, or nearest",
        );
        assertOptionalOneOf(
          patch.shaderLanguage,
          ["webgpu", "webgl2", "webgl1"],
          "preview.updateSettings shaderLanguage must be webgpu, webgl2, or webgl1",
        );
        assertOptionalBoolean(
          patch.autoRotate,
          "preview.updateSettings autoRotate must be a boolean",
        );
        assertOptionalBoolean(
          patch.showBackgroundCube,
          "preview.updateSettings showBackgroundCube must be a boolean",
        );
        [
          "spriteScale",
          "shapeScale",
          "roomScale",
          "bgOpacity",
          "bg3dOpacity",
          "zoomLevel",
        ].forEach((key) => {
          assertOptionalFiniteNumber(
            patch[key],
            `preview.updateSettings ${key} must be a finite number`,
          );
        });
        [
          "spriteTextureUrl",
          "shapeTextureUrl",
          "bgTextureUrl",
          "startupScript",
        ].forEach((key) => {
          assertOptionalString(
            patch[key],
            `preview.updateSettings ${key} must be a string`,
          );
        });

        syncPreviewSettings(blueprint, patch);
        return cloneValue(blueprint.previewSettings);
      },

      resetSettings() {
        blueprint.resetPreviewSettings();
        pushHistory(blueprint, "Reset preview settings");
        return cloneValue(blueprint.previewSettings);
      },

      getNodePreview() {
        return getPreviewNodeState(blueprint);
      },

      setNodePreview(nodeIdOrNull) {
        assert(
          nodeIdOrNull == null || Number.isInteger(Number(nodeIdOrNull)),
          "preview.setNodePreview requires a node id or null",
        );
        if (nodeIdOrNull == null) {
          blueprint.previewNode = null;
          blueprint.previewNeedsUpdate = true;
          blueprint.updatePreview();
          blueprint.render();
          return getPreviewNodeState(blueprint);
        }

        const node = getNodeById(blueprint, nodeIdOrNull);
        validatePreviewNode(node);
        blueprint.previewNode = node;
        blueprint.previewNeedsUpdate = true;
        blueprint.updatePreview();
        blueprint.render();
        return getPreviewNodeState(blueprint);
      },

      toggleNodePreview(nodeId) {
        assert(
          Number.isInteger(Number(nodeId)),
          "preview.toggleNodePreview requires a valid node id",
        );
        const node = getNodeById(blueprint, nodeId);
        if (blueprint.previewNode === node) {
          return api.preview.setNodePreview(null);
        }

        return api.preview.setNodePreview(node.id);
      },

      async screenshot(options = {}) {
        assertOptionalPlainObject(
          options,
          "preview.screenshot options must be an object",
        );
        assertOptionalBoolean(
          options.download,
          "preview.screenshot download must be a boolean",
        );
        if (options.download) {
          blueprint.screenshotPreview();
          return { ok: true, mode: "download" };
        }

        const dataUrl = await blueprint.getPreviewScreenshot();
        return {
          ok: dataUrl != null,
          mode: "dataUrl",
          dataUrl,
        };
      },
    },

    layout: {
      autoArrange(options = {}) {
        assertOptionalPlainObject(
          options,
          "layout.autoArrange options must be an object",
        );
        if (options.nodeIds !== undefined) {
          assert(
            Array.isArray(options.nodeIds),
            "layout.autoArrange nodeIds must be an array",
          );
          options.nodeIds.forEach((id) => {
            assert(
              Number.isInteger(Number(id)),
              "layout.autoArrange nodeIds must contain valid node ids",
            );
          });
        }
        if (Array.isArray(options.nodeIds) && options.nodeIds.length > 0) {
          const ids = new Set(options.nodeIds.map((id) => Number(id)));
          blueprint.selectedNodes.clear();
          blueprint.nodes.forEach((node) => {
            node.isSelected = ids.has(node.id);
            if (node.isSelected) {
              blueprint.selectedNodes.add(node);
            }
          });
        }

        blueprint.autoArrange();
        return {
          ok: true,
          camera: serializeCamera(blueprint),
        };
      },
    },

    selection: {
      get() {
        return {
          nodeIds: [...blueprint.selectedNodes].map((node) => node.id),
          count: blueprint.selectedNodes.size,
        };
      },

      clear() {
        blueprint.clearSelection();
        blueprint.render();
        return { nodeIds: [], count: 0 };
      },

      set(nodeIds) {
        assert(
          Array.isArray(nodeIds),
          "selection.set requires an array of node ids",
        );
        blueprint.clearSelection();
        nodeIds.forEach((id) => {
          const node = getNodeById(blueprint, id);
          node.isSelected = true;
          blueprint.selectedNodes.add(node);
        });
        blueprint.render();
        return {
          nodeIds: [...blueprint.selectedNodes].map((node) => node.id),
          count: blueprint.selectedNodes.size,
        };
      },

      add(nodeIds) {
        assert(
          Array.isArray(nodeIds),
          "selection.add requires an array of node ids",
        );
        nodeIds.forEach((id) => {
          const node = getNodeById(blueprint, id);
          node.isSelected = true;
          blueprint.selectedNodes.add(node);
        });
        blueprint.render();
        return {
          nodeIds: [...blueprint.selectedNodes].map((node) => node.id),
          count: blueprint.selectedNodes.size,
        };
      },

      remove(nodeIds) {
        assert(
          Array.isArray(nodeIds),
          "selection.remove requires an array of node ids",
        );
        nodeIds.forEach((id) => {
          const node = getNodeById(blueprint, id);
          node.isSelected = false;
          blueprint.selectedNodes.delete(node);
        });
        blueprint.render();
        return {
          nodeIds: [...blueprint.selectedNodes].map((node) => node.id),
          count: blueprint.selectedNodes.size,
        };
      },

      fitToView() {
        blueprint.fitSelectedToView();
        return {
          nodeIds: [...blueprint.selectedNodes].map((node) => node.id),
          count: blueprint.selectedNodes.size,
          camera: serializeCamera(blueprint),
        };
      },
    },

    camera: {
      center() {
        blueprint.centerView();
        return serializeCamera(blueprint);
      },

      zoomToFit() {
        blueprint.zoomToFit();
        return serializeCamera(blueprint);
      },

      setPosition(position) {
        assertPlainObject(position, "camera.setPosition requires an object");
        const { x, y } = position;
        assert(
          x !== undefined || y !== undefined,
          "camera.setPosition requires at least x or y",
        );
        assertOptionalFiniteNumber(
          x,
          "camera.setPosition x must be a finite number",
        );
        assertOptionalFiniteNumber(
          y,
          "camera.setPosition y must be a finite number",
        );
        if (x !== undefined) {
          blueprint.camera.x = Number(x);
        }
        if (y !== undefined) {
          blueprint.camera.y = Number(y);
        }
        blueprint.render();
        return serializeCamera(blueprint);
      },

      setZoom(zoom) {
        assertFiniteNumber(zoom, "camera.setZoom requires a finite number");
        blueprint.camera.zoom = Number(zoom);
        blueprint.updateZoomLevelDisplay();
        blueprint.render();
        return serializeCamera(blueprint);
      },

      getState() {
        return serializeCamera(blueprint);
      },
    },
  };

  globalThis.shaderGraphAPI = api;
  globalThis.sg = api;

  return api;
}
