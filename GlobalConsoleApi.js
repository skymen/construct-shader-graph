import { NODE_TYPES } from "./nodes/index.js";

const API_VERSION = "1.0.0";
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
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  if (value === undefined) {
    return undefined;
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

function getAllNodeTypes(bp) {
  const types = new Map();

  Object.entries(NODE_TYPES).forEach(([key, nodeType]) => {
    types.set(key, normalizeTypeSnapshot(nodeType, key));
  });

  Object.entries(bp.getUniformNodeTypes()).forEach(([key, nodeType]) => {
    types.set(key, normalizeTypeSnapshot(nodeType, key));
  });

  Object.entries(bp.getCustomNodeTypes()).forEach(([key, nodeType]) => {
    types.set(key, normalizeTypeSnapshot(nodeType, key));
  });

  return [...types.values()];
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

function validatePreviewNode(node) {
  const hasValidOutput = node.outputPorts.some((port) =>
    PREVIEWABLE_TYPES.has(port.getResolvedType()),
  );

  assert(
    hasValidOutput,
    `Node ${node.id} cannot be previewed because it has no float/vec2/vec3/vec4 output`,
  );
}

export function installGlobalConsoleApi(blueprint, helpers = {}) {
  assignMissingWireIds(blueprint);
  const { Wire: WireClass } = helpers;

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
        namespace: "shaderGraphAPI",
        alias: "sg",
        methods: [
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
        ],
      };
    },

    batch(label, fn) {
      assert(typeof fn === "function", "batch(label, fn) requires a function");

      batchState.active = true;
      batchState.dirty = false;

      try {
        const result = fn(api);
        if (batchState.dirty) {
          originalPushState(label || "Console batch");
        }
        return result;
      } finally {
        batchState.active = false;
        batchState.dirty = false;
      }
    },

    nodes: {
      create(input = {}) {
        const typeKey = input.typeKey || input.type;
        assert(typeKey, "nodes.create requires a type or typeKey");

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
        const node = getNodeById(blueprint, nodeId);
        applyNodePatch(blueprint, node, patch);
        finalizeNodeChange(blueprint, `Edit node (${node.title})`);
        return serializeNode(blueprint, node);
      },

      get(nodeId) {
        return serializeNode(blueprint, getNodeById(blueprint, nodeId));
      },

      getPorts(nodeId) {
        const node = getNodeById(blueprint, nodeId);
        return {
          inputs: node.inputPorts.map((port) => serializePort(blueprint, port)),
          outputs: node.outputPorts.map((port) => serializePort(blueprint, port)),
        };
      },

      list() {
        return blueprint.nodes.map((node) => serializeNode(blueprint, node));
      },

      search(query = "", options = {}) {
        return api.nodeTypes.search(query, options);
      },
    },

    nodeTypes: {
      list(options = {}) {
        const types = options.availableOnly
          ? blueprint
              .getFilteredNodeTypes()
              .map(([key, nodeType]) => normalizeTypeSnapshot(nodeType, key))
          : getAllNodeTypes(blueprint);
        return filterNodeTypes(types, options.query || "");
      },

      search(query = "", options = {}) {
        return api.nodeTypes.list({ ...options, query });
      },

      get(typeKey) {
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
        const startPort = resolvePortRef(blueprint, from, "output");
        const endPort = resolvePortRef(blueprint, to, "input");

        assert(startPort.canConnectTo(endPort), "Ports are not compatible for connection");

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
        const wire = getWireByRef(blueprint, wireRef);
        const wireId = getWireId(blueprint, wire);
        blueprint.disconnectWire(wire);
        blueprint.render();
        blueprint.updateDependencyList();
        pushHistory(blueprint, "Delete wire");
        return { ok: true, wireId };
      },

      get(wireRef) {
        return serializeWire(blueprint, getWireByRef(blueprint, wireRef));
      },

      getAll() {
        return blueprint.wires.map((wire) => serializeWire(blueprint, wire));
      },
    },

    uniforms: {
      create(input = {}) {
        const name = String(input.name || "").trim();
        assert(name, "uniforms.create requires a name");

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

      edit(uniformId, patch = {}) {
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
        const uniform = getUniformById(blueprint, uniformId);
        blueprint.deleteUniform(uniform.id);
        return { ok: true, uniformId: uniform.id };
      },

      reorder(uniformId, newIndex) {
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
        Object.keys(patch).forEach((key) => {
          assert(
            Object.prototype.hasOwnProperty.call(blueprint.shaderSettings, key),
            `Unknown shader setting '${key}'`,
          );
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

      getStartupScriptInfo() {
        return getStartupScriptInfo();
      },

      updateSettings(patch = {}) {
        Object.keys(patch).forEach((key) => {
          assert(PREVIEW_SETTING_KEYS.has(key), `Unknown preview setting '${key}'`);
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
        const node = getNodeById(blueprint, nodeId);
        if (blueprint.previewNode === node) {
          return api.preview.setNodePreview(null);
        }

        return api.preview.setNodePreview(node.id);
      },

      async screenshot(options = {}) {
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

      setPosition({ x, y }) {
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
