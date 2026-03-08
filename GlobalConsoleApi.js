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

function worldCenter(bp) {
  return {
    x:
      (-bp.camera.x + (bp.logicalWidth || bp.canvas.width) / 2) / bp.camera.zoom,
    y:
      (-bp.camera.y + (bp.logicalHeight || bp.canvas.height) / 2) / bp.camera.zoom,
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
  const normalizedQuery = String(query || "").trim().toLowerCase();
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

  const previewErrors = api.preview.getErrors({ limit: options.previewErrorLimit ?? 50 });
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
  assert(portRef && typeof portRef === "object", "Port reference must be an object");

  const node = getNodeById(bp, portRef.nodeId);
  const kind = portRef.kind || portRef.type;
  assert(kind === "input" || kind === "output", "Port reference kind must be 'input' or 'output'");
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

  assert(port, `Port not found on node ${node.id}`);
  return port;
}

function getWireByRef(bp, wireRef) {
  if (typeof wireRef === "number" || typeof wireRef === "string") {
    const wireId = Number(wireRef);
    assert(Number.isInteger(wireId), `Wire reference '${wireRef}' must be a valid wire id`);
    const wire = bp.wires.find((entry) => getWireId(bp, entry) === wireId);
    assert(wire, `Wire ${wireRef} not found`);
    return wire;
  }

  assert(wireRef && typeof wireRef === "object", "Wire reference must be an id or object");
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
  assert(/^\d+(?:\.\d+){3}$/.test(value.trim()), "Version must use X.X.X.X format");
  return value.trim();
}

function validateBumpVersion(value) {
  assert(typeof value === "string", "bumpVersion must be a string");
  const normalized = value.trim();
  assertOneOf(normalized, ["major", "minor", "patch"], "bumpVersion must be 'major', 'minor', or 'patch'");
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
    assert(port.connections.length === 0, `Input port '${port.name}' is connected and cannot be edited directly`);

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
  const hasExplicitStops = Object.prototype.hasOwnProperty.call(patch, "gradientStops");
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
    assert(node.nodeType.hasOperation, `Node ${node.id} does not support operations`);
    node.updateOperation(patch.operation, bp);
  }

  if (patch.customInput !== undefined) {
    assert(node.nodeType.hasCustomInput, `Node ${node.id} does not support custom input`);
    const nextValue = validateVariableName(bp, node, String(patch.customInput));
    node.updateCustomInput(nextValue, bp);
  }

  if (patch.selectedVariable !== undefined) {
    assert(node.nodeType.hasVariableDropdown, `Node ${node.id} does not support variable selection`);
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
    } else if (object !== "sprite" && bp.previewSettings.effectTarget === "sprite") {
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
      bp.sendPreviewCommand("setShowBackgroundCube", !!patch.showBackgroundCube);
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
    shell.style.position = "fixed";
    shell.style.right = "16px";
    shell.style.bottom = "16px";
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
    document.body.appendChild(shell);
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
    description: "Get the current project identity derived from shader settings.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "Current project identity and shader info." },
  },
  {
    path: "getManifest",
    description: "Get the machine-readable API manifest for MCP clients.",
    mutates: false,
    args: [],
    returns: { type: "object", description: "API manifest and project metadata." },
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
        description: "Batch label and commands array with method and args entries.",
      },
    ],
    returns: { type: "object", description: "Batch execution results." },
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
        description: "Optional title/message behavior for the AI work indicator.",
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
    returns: { type: "array", description: "Available example project metadata." },
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
    returns: { type: "object", description: "Opened example metadata and shader name." },
  },
  {
    path: "projects.exportAddon",
    description: "Export the current shader addon, optionally updating the version first.",
    mutates: true,
    args: [
      {
        name: "options",
        type: "object",
        required: false,
        description: "Optional version or bumpVersion export settings.",
      },
    ],
    returns: { type: "object", description: "Export result with the active version." },
  },
  {
    path: "customNodes.list",
    description: "List all custom node definitions.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Serialized custom node definitions." },
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
    returns: { type: "object", description: "Serialized custom node definition." },
  },
  {
    path: "ai.getWarnings",
    description: "Return AI-focused graph cleanup warnings.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Structured warning entries for the current graph." },
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
        description: "Optional limits and screenshot settings for the debug check.",
      },
    ],
    returns: { type: "object", description: "Generated code status, preview errors, warnings, and optional screenshot." },
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
        description: "Node type, position, optional patch data, and selection options.",
      },
    ],
    returns: { type: "object", description: "Serialized created node." },
  },
  {
    path: "nodes.delete",
    description: "Delete a non-output node and its connected wires.",
    mutates: true,
    args: [
      { name: "nodeId", type: "number", required: true, description: "Node id to delete." },
    ],
    returns: { type: "object", description: "Deletion status and node id." },
  },
  {
    path: "nodes.edit",
    description: "Apply a patch to an existing node.",
    mutates: true,
    args: [
      { name: "nodeId", type: "number", required: true, description: "Node id to edit." },
      {
        name: "patch",
        type: "object",
        required: true,
        description: "Node field updates such as position, operation, data, or input values.",
      },
    ],
    returns: { type: "object", description: "Serialized updated node." },
  },
  {
    path: "nodes.get",
    description: "Get one node by id.",
    mutates: false,
    args: [
      { name: "nodeId", type: "number", required: true, description: "Node id to fetch." },
    ],
    returns: { type: "object", description: "Serialized node." },
  },
  {
    path: "nodes.getInfo",
    description: "Get full info for one node by id.",
    mutates: false,
    args: [
      { name: "nodeId", type: "number", required: true, description: "Node id to fetch." },
    ],
    returns: { type: "object", description: "Serialized node." },
  },
  {
    path: "nodes.getPorts",
    description: "Get the input and output ports for one node.",
    mutates: false,
    args: [
      { name: "nodeId", type: "number", required: true, description: "Node id to inspect." },
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
      { name: "query", type: "string", required: false, description: "Search text." },
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
      { name: "query", type: "string", required: false, description: "Search text." },
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
      { name: "typeKey", type: "string", required: true, description: "Node type key." },
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
        description: "Port reference containing nodeId plus kind/type and name/index.",
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
        description: "Port reference containing nodeId plus kind/type and name/index.",
      },
    ],
    returns: { type: "array", description: "Serialized wires attached to the port." },
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
        description: "Uniform name, type, value, description, and percent settings.",
      },
    ],
    returns: { type: "object", description: "Serialized created uniform." },
  },
  {
    path: "uniforms.createNode",
    description: "Create a graph node for an existing uniform.",
    mutates: true,
    args: [
      { name: "uniformId", type: "number", required: true, description: "Uniform id." },
      {
        name: "options",
        type: "object",
        required: false,
        description: "Position and selection options for the created node.",
      },
    ],
    returns: { type: "object", description: "Serialized created uniform node." },
  },
  {
    path: "uniforms.getNodeTypes",
    description: "List node types generated from current uniforms.",
    mutates: false,
    args: [],
    returns: { type: "array", description: "Uniform-backed node type snapshots." },
  },
  {
    path: "uniforms.edit",
    description: "Edit an existing uniform.",
    mutates: true,
    args: [
      { name: "uniformId", type: "number", required: true, description: "Uniform id to edit." },
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
      { name: "uniformId", type: "number", required: true, description: "Uniform id to delete." },
    ],
    returns: { type: "object", description: "Deletion status and uniform id." },
  },
  {
    path: "uniforms.reorder",
    description: "Move a uniform to a new list position.",
    mutates: true,
    args: [
      { name: "uniformId", type: "number", required: true, description: "Uniform id to move." },
      { name: "newIndex", type: "number", required: true, description: "Destination index." },
    ],
    returns: { type: "array", description: "Updated serialized uniform list." },
  },
  {
    path: "uniforms.get",
    description: "Get one uniform by id.",
    mutates: false,
    args: [
      { name: "uniformId", type: "number", required: true, description: "Uniform id to fetch." },
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
    description: "Patch shader metadata such as name, version, author, and flags.",
    mutates: true,
    args: [
      { name: "patch", type: "object", required: true, description: "Shader settings patch." },
    ],
    returns: { type: "object", description: "Updated shader settings snapshot." },
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
    returns: { type: "object", description: "Startup script support metadata." },
  },
  {
    path: "preview.updateSettings",
    description: "Patch preview settings.",
    mutates: true,
    args: [
      { name: "patch", type: "object", required: true, description: "Preview settings patch." },
    ],
    returns: { type: "object", description: "Updated preview settings snapshot." },
  },
  {
    path: "preview.resetSettings",
    description: "Reset preview settings to defaults.",
    mutates: true,
    args: [],
    returns: { type: "object", description: "Reset preview settings snapshot." },
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
      { name: "nodeId", type: "number", required: true, description: "Target node id." },
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
    returns: { type: "object", description: "Arrangement status and resulting camera state." },
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
      { name: "zoom", type: "number", required: true, description: "New zoom level." },
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
  assert(typeof path === "string" && path.trim(), "Method path must be a non-empty string");

  return path.split(".").reduce((current, segment) => {
    assert(segment !== "__proto__" && segment !== "prototype" && segment !== "constructor", "Invalid method path segment");
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

export function installGlobalConsoleApi(blueprint, helpers = {}) {
  assignMissingWireIds(blueprint);
  const { Wire: WireClass, exampleFiles } = helpers;

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
          "nodes",
          "nodeTypes",
          "ports",
          "wires",
          "uniforms",
          "shader",
          "preview",
          "layout",
          "camera",
          "batch",
          "getProjectIdentity",
          "getManifest",
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

    call(methodPath, args = []) {
      const descriptor = API_METHOD_DESCRIPTOR_MAP.get(methodPath);
      assert(descriptor, `Unknown API method '${methodPath}'`);

      const fn = resolveApiMethod(api, methodPath);
      assert(typeof fn === "function", `Method '${methodPath}' is not callable`);

      const inputArgs = Array.isArray(args) ? args : [args];
      return fn(...inputArgs);
    },

    async runCommands({ label = "API command batch", commands = [] } = {}) {
      assertPlainObject(arguments[0] ?? {}, "runCommands requires an input object");
      if (label !== undefined) {
        assert(typeof label === "string", "runCommands label must be a string");
      }
      assert(Array.isArray(commands), "runCommands requires a commands array");

      return api.batch(label, async () => {
        const results = [];

        for (const [index, command] of commands.entries()) {
          assert(command && typeof command === "object", `Command at index ${index} must be an object`);
          assertNonEmptyString(command.method, `Command at index ${index} is missing a method`);
          if (command.args !== undefined) {
            assert(Array.isArray(command.args), `Command '${command.method}' args must be an array`);
          }

          const result = await api.call(command.method, command.args || []);
          results.push({
            index,
            method: command.method,
            result,
          });
        }

        return {
          ok: true,
          label,
          results,
        };
      });
    },

    session: {
      initAIWork(options = {}) {
        assertOptionalPlainObject(options, "session.initAIWork options must be an object");
        assertOptionalString(options.title, "session.initAIWork title must be a string");
        assertOptionalString(options.message, "session.initAIWork message must be a string");
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
        assert(typeof message === "string" || message === undefined, "session.updateAIWork message must be a string");
        const status = ensureAiStatusElements();
        status.message.textContent = String(message || "Working...");
        status.shell.style.display = "block";
        return {
          active: true,
          message: status.message.textContent,
        };
      },

      endAIWork(options = {}) {
        assertOptionalPlainObject(options, "session.endAIWork options must be an object");
        assertOptionalString(options.title, "session.endAIWork title must be a string");
        assertOptionalArray(options.summary, "session.endAIWork summary must be an array");
        assertOptionalFiniteNumber(options.duration, "session.endAIWork duration must be a finite number");

        const status = ensureAiStatusElements();
        status.shell.style.display = "none";

        const summary = Array.isArray(options.summary)
          ? options.summary.filter(Boolean)
          : [];
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
        assertNonEmptyString(exampleId, "projects.openExample requires a non-empty example id string");
        const data = await openExampleProject(blueprint, exampleFiles, exampleId);
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
        assertOptionalPlainObject(options, "projects.exportAddon options must be an object");
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
          typeof customNodeIdOrKey === "string" || typeof customNodeIdOrKey === "number",
          "customNodes.get requires a custom node id or custom_<id> key",
        );
        const customNodeId = String(customNodeIdOrKey).startsWith("custom_")
          ? Number(String(customNodeIdOrKey).replace("custom_", ""))
          : Number(customNodeIdOrKey);
        assert(Number.isInteger(customNodeId), `Invalid custom node reference '${customNodeIdOrKey}'`);
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
        assertOptionalPlainObject(options, "ai.runDebugCheck options must be an object");
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
        assertNonEmptyString(typeKey, "nodes.create requires a non-empty type or typeKey string");
        assertOptionalFiniteNumber(input.x, "nodes.create x must be a finite number");
        assertOptionalFiniteNumber(input.y, "nodes.create y must be a finite number");
        assertOptionalPlainObject(input.position, "nodes.create position must be an object");
        if (input.position) {
          assertOptionalFiniteNumber(input.position.x, "nodes.create position.x must be a finite number");
          assertOptionalFiniteNumber(input.position.y, "nodes.create position.y must be a finite number");
        }
        assertOptionalPlainObject(input.patch, "nodes.create patch must be an object");
        assertOptionalString(input.operation, "nodes.create operation must be a string");
        assertOptionalString(input.customInput, "nodes.create customInput must be a string");
        assertOptionalString(input.selectedVariable, "nodes.create selectedVariable must be a string");
        assertOptionalBoolean(input.select, "nodes.create select must be a boolean");

        if (typeKey === "output") {
          assert(
            !blueprint.nodes.some((node) => blueprint.getNodeTypeKey(node.nodeType) === "output"),
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
          applyNodePatch(blueprint, node, { selectedVariable: input.selectedVariable });
        }

        if (input.inputValues !== undefined) {
          applyNodePatch(blueprint, node, { inputValues: input.inputValues });
        }

        if (input.gradientStops !== undefined) {
          applyNodePatch(blueprint, node, { gradientStops: input.gradientStops });
        }

        if (input.select) {
          blueprint.clearSelection();
          blueprint.selectNode(node, false);
        }

        pushHistory(blueprint, `Create node (${node.title})`);
        return serializeNode(blueprint, node);
      },

      delete(nodeId) {
        assert(Number.isInteger(Number(nodeId)), "nodes.delete requires a valid node id");
        const node = getNodeById(blueprint, nodeId);
        assert(
          blueprint.getNodeTypeKey(node.nodeType) !== "output",
          "The Output node cannot be deleted",
        );

        const connectedWires = new Set();
        node.getAllPorts().forEach((port) => {
          port.connections.forEach((wire) => connectedWires.add(wire));
        });

        connectedWires.forEach((wire) => blueprint.disconnectWire(wire));
        blueprint.nodes = blueprint.nodes.filter((entry) => entry !== node);
        blueprint.selectedNodes.delete(node);

        if (blueprint.previewNode === node) {
          blueprint.previewNode = null;
        }

        finalizeNodeChange(blueprint, `Delete node (${node.title})`);
        return { ok: true, nodeId: node.id };
      },

      edit(nodeId, patch = {}) {
        assert(Number.isInteger(Number(nodeId)), "nodes.edit requires a valid node id");
        assertPlainObject(patch, "nodes.edit patch must be an object");
        const node = getNodeById(blueprint, nodeId);
        assert(hasNodePatchChanges(patch), `No supported patch fields provided for node ${nodeId}`);
        applyNodePatch(blueprint, node, patch);
        finalizeNodeChange(blueprint, `Edit node (${node.title})`);
        return serializeNode(blueprint, node);
      },

      get(nodeId) {
        assert(Number.isInteger(Number(nodeId)), "nodes.get requires a valid node id");
        return serializeNodeSummary(blueprint, getNodeById(blueprint, nodeId));
      },

      getInfo(nodeId) {
        assert(Number.isInteger(Number(nodeId)), "nodes.getInfo requires a valid node id");
        return serializeNode(blueprint, getNodeById(blueprint, nodeId));
      },

      getPorts(nodeId) {
        assert(Number.isInteger(Number(nodeId)), "nodes.getPorts requires a valid node id");
        const node = getNodeById(blueprint, nodeId);
        return {
          inputs: node.inputPorts.map((port) => serializePort(blueprint, port)),
          outputs: node.outputPorts.map((port) => serializePort(blueprint, port)),
        };
      },

      list() {
        return blueprint.nodes.map((node) => serializeNodeSummary(blueprint, node));
      },

      search(query = "", options = {}) {
        assert(typeof query === "string", "nodes.search query must be a string");
        assertOptionalPlainObject(options, "nodes.search options must be an object");
        return api.nodeTypes.search(query, options);
      },
    },

    nodeTypes: {
      list(options = {}) {
        assertOptionalPlainObject(options, "nodeTypes.list options must be an object");
        assertOptionalBoolean(options.availableOnly, "nodeTypes.list availableOnly must be a boolean");
        assertOptionalString(options.query, "nodeTypes.list query must be a string");
        const types = options.availableOnly
          ? blueprint
              .getFilteredNodeTypes()
              .map(([key, nodeType]) => serializeNodeTypeSummary(nodeType, key))
          : getAllNodeTypes(blueprint);
        return filterNodeTypes(types, options.query || "");
      },

      search(query = "", options = {}) {
        assert(typeof query === "string", "nodeTypes.search query must be a string");
        assertOptionalPlainObject(options, "nodeTypes.search options must be an object");
        return api.nodeTypes.list({ ...options, query });
      },

      get(typeKey) {
        assertNonEmptyString(typeKey, "nodeTypes.get requires a non-empty type key string");
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
        assertPlainObject(arguments[0], "wires.create requires an object with from and to port refs");
        const startPort = resolvePortRef(blueprint, from, "output");
        const endPort = resolvePortRef(blueprint, to, "input");

        assert(startPort.canConnectTo(endPort), "Ports are not compatible for connection");

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
        assert(wireRef !== undefined, "wires.delete requires a wire id or from/to reference");
        const wire = getWireByRef(blueprint, wireRef);
        const wireId = getWireId(blueprint, wire);
        blueprint.disconnectWire(wire);
        blueprint.render();
        blueprint.updateDependencyList();
        pushHistory(blueprint, "Delete wire");
        return { ok: true, wireId };
      },

      get(wireRef) {
        assert(wireRef !== undefined, "wires.get requires a wire id or from/to reference");
        return serializeWire(blueprint, getWireByRef(blueprint, wireRef));
      },

      getAll() {
        return blueprint.wires.map((wire) => serializeWireSummary(blueprint, wire));
      },
    },

    uniforms: {
      create(input = {}) {
        assertPlainObject(input, "uniforms.create requires an input object");
        const name = String(input.name || "").trim();
        assert(name, "uniforms.create requires a name");
        assertOptionalString(input.description, "uniforms.create description must be a string");
        assertOptionalBoolean(input.isPercent, "uniforms.create isPercent must be a boolean");

        const type = input.type || "float";
        assert(type === "float" || type === "color", "Uniform type must be 'float' or 'color'");

        let variableName = `uniform_${blueprint.sanitizeVariableName(name)}`;
        let counter = 1;
        const baseVariableName = variableName;
        while (
          blueprint.uniforms.some((entry) => entry.variableName === variableName) ||
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
        assert(Number.isInteger(Number(uniformId)), "uniforms.createNode requires a valid uniform id");
        assertOptionalPlainObject(options, "uniforms.createNode options must be an object");
        assertOptionalFiniteNumber(options.x, "uniforms.createNode x must be a finite number");
        assertOptionalFiniteNumber(options.y, "uniforms.createNode y must be a finite number");
        assertOptionalPlainObject(options.position, "uniforms.createNode position must be an object");
        if (options.position) {
          assertOptionalFiniteNumber(options.position.x, "uniforms.createNode position.x must be a finite number");
          assertOptionalFiniteNumber(options.position.y, "uniforms.createNode position.y must be a finite number");
        }
        assertOptionalBoolean(options.select, "uniforms.createNode select must be a boolean");
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
        return Object.entries(blueprint.getUniformNodeTypes()).map(([key, nodeType]) =>
          normalizeTypeSnapshot(nodeType, key),
        );
      },

      edit(uniformId, patch = {}) {
        assert(Number.isInteger(Number(uniformId)), "uniforms.edit requires a valid uniform id");
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
              (entry) => entry.id !== uniform.id && entry.variableName === nextVariableName,
            ) ||
            blueprint.uniforms.some(
              (entry) => entry.id !== uniform.id && entry.name === nextVariableName,
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
        assert(Number.isInteger(Number(uniformId)), "uniforms.delete requires a valid uniform id");
        const uniform = getUniformById(blueprint, uniformId);
        blueprint.deleteUniform(uniform.id);
        return { ok: true, uniformId: uniform.id };
      },

      reorder(uniformId, newIndex) {
        assert(Number.isInteger(Number(uniformId)), "uniforms.reorder requires a valid uniform id");
        assertFiniteNumber(newIndex, "uniforms.reorder newIndex must be a finite number");
        const index = blueprint.uniforms.findIndex((entry) => entry.id === Number(uniformId));
        assert(index >= 0, `Uniform ${uniformId} not found`);

        const targetIndex = Math.max(0, Math.min(Number(newIndex), blueprint.uniforms.length - 1));
        const [uniform] = blueprint.uniforms.splice(index, 1);
        blueprint.uniforms.splice(targetIndex, 0, uniform);
        blueprint.renderUniformList();
        blueprint.onShaderChanged();
        blueprint.sendUniformValuesToPreview();
        pushHistory(blueprint, `Reorder uniform (${uniform.name})`);
        return blueprint.uniforms.map((entry, position) => serializeUniform(entry, position));
      },

      get(uniformId) {
        assert(Number.isInteger(Number(uniformId)), "uniforms.get requires a valid uniform id");
        const uniform = getUniformById(blueprint, uniformId);
        return serializeUniform(
          uniform,
          blueprint.uniforms.findIndex((entry) => entry.id === uniform.id),
        );
      },

      list() {
        return blueprint.uniforms.map((uniform, index) => serializeUniform(uniform, index));
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
        assertOptionalPlainObject(options, "preview.getConsoleEntries options must be an object");
        if (options.level !== undefined) {
          if (Array.isArray(options.level)) {
            options.level.forEach((level) => {
              assert(typeof level === "string", "preview.getConsoleEntries level entries must be strings");
            });
          } else {
            assert(typeof options.level === "string", "preview.getConsoleEntries level must be a string or array of strings");
          }
        }
        assertOptionalFiniteNumber(options.limit, "preview.getConsoleEntries limit must be a finite number");

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
        assertOptionalPlainObject(options, "preview.getErrors options must be an object");
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
        assertPlainObject(patch, "preview.updateSettings patch must be an object");
        Object.keys(patch).forEach((key) => {
          assert(PREVIEW_SETTING_KEYS.has(key), `Unknown preview setting '${key}'`);
        });

        assertOptionalOneOf(
          patch.effectTarget,
          ["sprite", "shape3D", "layout", "layer"],
          "preview.updateSettings effectTarget must be one of sprite, shape3D, layout, or layer",
        );
        assertOptionalOneOf(
          patch.object,
          ["sprite", "box", "sphere", "cylinder", "capsule", "cone", "torus", "plane"],
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
        ["spriteTextureUrl", "shapeTextureUrl", "bgTextureUrl", "startupScript"].forEach(
          (key) => {
            assertOptionalString(
              patch[key],
              `preview.updateSettings ${key} must be a string`,
            );
          },
        );

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
        assert(Number.isInteger(Number(nodeId)), "preview.toggleNodePreview requires a valid node id");
        const node = getNodeById(blueprint, nodeId);
        if (blueprint.previewNode === node) {
          return api.preview.setNodePreview(null);
        }

        return api.preview.setNodePreview(node.id);
      },

      async screenshot(options = {}) {
        assertOptionalPlainObject(options, "preview.screenshot options must be an object");
        assertOptionalBoolean(options.download, "preview.screenshot download must be a boolean");
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
        assertOptionalPlainObject(options, "layout.autoArrange options must be an object");
        if (options.nodeIds !== undefined) {
          assert(Array.isArray(options.nodeIds), "layout.autoArrange nodeIds must be an array");
          options.nodeIds.forEach((id) => {
            assert(Number.isInteger(Number(id)), "layout.autoArrange nodeIds must contain valid node ids");
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
        assertOptionalFiniteNumber(x, "camera.setPosition x must be a finite number");
        assertOptionalFiniteNumber(y, "camera.setPosition y must be a finite number");
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
