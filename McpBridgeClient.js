const MCP_STORAGE_URL_KEY = "shader-graph-mcp-url";
const DEFAULT_MCP_URL = "ws://127.0.0.1:6359";
const RECONNECT_DELAY_MS = 2000;

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeWebSocketUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return DEFAULT_MCP_URL;
  }

  const prefixed = /^[a-z]+:\/\//i.test(raw) ? raw : `ws://${raw}`;
  const parsed = new URL(prefixed);
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("MCP URL must start with ws:// or wss://");
  }
  return parsed.toString().replace(/\/$/, "");
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack || "",
      name: error.name,
    };
  }

  return {
    message: String(error),
    stack: "",
    name: "Error",
  };
}

export class McpBridgeClient {
  constructor(options) {
    this.api = options.api;
    this.getApi = options.getApi || (() => this.api || globalThis.shaderGraphAPI || null);
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onNotification = options.onNotification || (() => {});
    this.url = null;
    this.socket = null;
    this.sessionId = createSessionId();
    this.status = "idle";
    this.lastError = null;
    this.shouldReconnect = false;
    this.reconnectTimer = null;
    this.intentionalClose = false;
  }

  getSavedUrl() {
    try {
      return localStorage.getItem(MCP_STORAGE_URL_KEY);
    } catch {
      return null;
    }
  }

  saveUrl(url) {
    localStorage.setItem(MCP_STORAGE_URL_KEY, url);
  }

  clearSavedUrl() {
    localStorage.removeItem(MCP_STORAGE_URL_KEY);
  }

  resolveApi() {
    return this.getApi();
  }

  getFallbackProject() {
    return {
      name: "Untitled Shader",
      version: "0.0.0.0",
      author: "",
      category: "",
      description: "",
      shaderInfo: null,
    };
  }

  getManifest() {
    const api = this.resolveApi();
    if (!api || typeof api.getManifest !== "function") {
      return null;
    }

    return api.getManifest();
  }

  getProject() {
    const api = this.resolveApi();
    if (!api || typeof api.getProjectIdentity !== "function") {
      return this.getFallbackProject();
    }

    return api.getProjectIdentity();
  }

  getStatus() {
    return {
      status: this.status,
      url: this.url,
      sessionId: this.sessionId,
      project: this.getProject(),
      lastError: this.lastError,
      savedUrl: this.getSavedUrl(),
    };
  }

  emitStatus() {
    this.onStatusChange(this.getStatus());
  }

  setStatus(status, error = null) {
    this.status = status;
    this.lastError = error;
    this.emitStatus();
  }

  notify(notification) {
    this.onNotification(notification);
  }

  async autoConnect() {
    const savedUrl = this.getSavedUrl();
    if (!savedUrl) {
      this.emitStatus();
      return false;
    }

    try {
      await this.connect(savedUrl, { persist: true, announceFailure: false });
      return true;
    } catch {
      return false;
    }
  }

  async connect(url = DEFAULT_MCP_URL, options = {}) {
    const normalizedUrl = normalizeWebSocketUrl(url);
    const persist = options.persist !== false;

    this.clearReconnectTimer();
    this.intentionalClose = false;
    this.shouldReconnect = persist;
    this.url = normalizedUrl;
    this.setStatus("connecting");

    if (persist) {
      this.saveUrl(normalizedUrl);
    }

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close errors when reconnecting.
      }
    }

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(normalizedUrl);
      let settled = false;

      const cleanup = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
      };

      const handleOpen = () => {
        cleanup();
        this.socket = socket;
        this.attachSocketHandlers(socket);
        this.setStatus("connected");
        this.sendRegistration();
        settled = true;
        resolve();
      };

      const handleError = () => {
        cleanup();
        const error = serializeError(new Error(`Unable to connect to MCP at ${normalizedUrl}`));
        this.setStatus("error", error);
        if (persist) {
          this.scheduleReconnect();
        }
        settled = true;
        reject(new Error(error.message));
      };

      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });

      setTimeout(() => {
        if (settled) {
          return;
        }
        cleanup();
        try {
          socket.close();
        } catch {
          // Ignore timeout close errors.
        }
        const error = serializeError(new Error(`Timed out connecting to MCP at ${normalizedUrl}`));
        this.setStatus("error", error);
        if (persist) {
          this.scheduleReconnect();
        }
        reject(new Error(error.message));
      }, options.timeoutMs || 3500);
    });

    return this.getStatus();
  }

  disconnect({ clearSavedUrl = true } = {}) {
    this.intentionalClose = true;
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    if (clearSavedUrl) {
      this.clearSavedUrl();
    }

    if (this.socket) {
      try {
        this.socket.close(1000, "Client disconnected");
      } catch {
        // Ignore close errors.
      }
      this.socket = null;
    }

    this.url = clearSavedUrl ? null : this.url;
    this.setStatus("idle");
    return this.getStatus();
  }

  scheduleReconnect() {
    if (!this.shouldReconnect || !this.url || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url, { persist: true, announceFailure: false }).catch(() => {});
    }, RECONNECT_DELAY_MS);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  attachSocketHandlers(socket) {
    socket.addEventListener("close", (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      if (this.intentionalClose) {
        this.intentionalClose = false;
        return;
      }

      const error =
        event.code === 1000
          ? null
          : serializeError(new Error(`MCP connection closed (${event.code})`));
      this.setStatus("error", error);
      this.scheduleReconnect();
    });

    socket.addEventListener("message", async (event) => {
      await this.handleMessage(event.data);
    });
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("MCP bridge is not connected");
    }

    this.socket.send(JSON.stringify(payload));
  }

  sendRegistration() {
    this.send({
      type: "register",
      sessionId: this.sessionId,
      project: this.getProject(),
      manifest: this.getManifest(),
    });
  }

  sendProjectUpdate(reason = "state-changed") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.send({
      type: "project-updated",
      sessionId: this.sessionId,
      reason,
      project: this.getProject(),
      manifest: this.getManifest(),
    });
  }

  async handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "ping") {
      this.send({ type: "pong", sessionId: this.sessionId, timestamp: Date.now() });
      return;
    }

    if (message.type === "invoke") {
      await this.handleInvoke(message);
      return;
    }

    if (message.type === "registered") {
      this.notify({
        type: "info",
        title: "MCP connected",
        message: `Connected to ${this.url}`,
      });
    }
  }

  async handleInvoke(message) {
    const api = this.resolveApi();
    const requestId = message.requestId || `req-${Date.now()}`;
    const method = message.method;
    const args = Array.isArray(message.args) ? message.args : [];
    const startedAt = performance.now();

    if (!api || typeof api.call !== "function") {
      this.send({
        type: "result",
        requestId,
        ok: false,
        sessionId: this.sessionId,
        project: this.getProject(),
        method,
        args,
        durationMs: Math.round(performance.now() - startedAt),
        error: serializeError(new Error("shaderGraphAPI is not ready yet")),
      });
      return;
    }

    try {
      const result = await api.call(method, args);
      this.send({
        type: "result",
        requestId,
        ok: true,
        sessionId: this.sessionId,
        project: this.getProject(),
        method,
        args,
        durationMs: Math.round(performance.now() - startedAt),
        result,
      });
    } catch (error) {
      this.send({
        type: "result",
        requestId,
        ok: false,
        sessionId: this.sessionId,
        project: this.getProject(),
        method,
        args,
        durationMs: Math.round(performance.now() - startedAt),
        error: serializeError(error),
      });
    }
  }
}

export { DEFAULT_MCP_URL, MCP_STORAGE_URL_KEY, normalizeWebSocketUrl };
