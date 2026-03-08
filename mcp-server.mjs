import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { z } from "zod";

const BRIDGE_PORT = Number(process.env.MCP_BRIDGE_PORT || 6359);

const sessions = new Map();
let selectedSessionId = null;

function log(message, ...args) {
  console.error(`[mcp-bridge] ${message}`, ...args);
}

function nowIso() {
  return new Date().toISOString();
}

function getSessionSummary(session) {
  return {
    sessionId: session.sessionId,
    project: session.project,
    connectedAt: session.connectedAt,
    updatedAt: session.updatedAt,
    manifestVersion: session.manifest?.version || null,
    methodCount: Array.isArray(session.manifest?.methods)
      ? session.manifest.methods.length
      : 0,
    selected: selectedSessionId === session.sessionId,
  };
}

function ensureSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Unknown session '${sessionId}'`);
  }
  return session;
}

function ensureSelectedSession() {
  if (!selectedSessionId) {
    throw new Error("No project selected. Call select_project first.");
  }

  return ensureSession(selectedSessionId);
}

function sendJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function invokeSession(session, method, args = []) {
  return new Promise((resolve, reject) => {
    if (session.socket.readyState !== session.socket.OPEN) {
      reject(new Error(`Session '${session.sessionId}' is not connected`));
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const timeoutId = setTimeout(() => {
      session.pending.delete(requestId);
      reject(new Error(`Timed out waiting for '${method}' result from session '${session.sessionId}'`));
    }, 15000);

    session.pending.set(requestId, {
      resolve,
      reject,
      timeoutId,
      method,
    });

    sendJson(session.socket, {
      type: "invoke",
      requestId,
      method,
      args,
    });
  });
}

const bridge = new WebSocketServer({ host: "127.0.0.1", port: BRIDGE_PORT });

bridge.on("connection", (socket) => {
  let activeSessionId = null;

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "register") {
      const sessionId = String(message.sessionId || "").trim();
      if (!sessionId) {
        sendJson(socket, { type: "error", message: "Missing sessionId" });
        return;
      }

      const session = {
        sessionId,
        socket,
        project: message.project || { name: "Untitled Shader", version: "0.0.0.0" },
        manifest: message.manifest || null,
        connectedAt: nowIso(),
        updatedAt: nowIso(),
        pending: new Map(),
      };

      sessions.set(sessionId, session);
      activeSessionId = sessionId;
      if (!selectedSessionId) {
        selectedSessionId = sessionId;
      }

      log(`registered ${sessionId} (${session.project?.name || "Untitled Shader"})`);
      sendJson(socket, {
        type: "registered",
        sessionId,
        selected: selectedSessionId === sessionId,
      });
      return;
    }

    if (!activeSessionId) {
      return;
    }

    const session = sessions.get(activeSessionId);
    if (!session) {
      return;
    }

    session.updatedAt = nowIso();

    if (message.type === "project-updated") {
      session.project = message.project || session.project;
      session.manifest = message.manifest || session.manifest;
      return;
    }

    if (message.type === "result") {
      const pending = session.pending.get(message.requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      session.pending.delete(message.requestId);

      if (message.ok) {
        pending.resolve(message);
      } else {
        const error = new Error(message.error?.message || `Call '${pending.method}' failed`);
        error.stack = message.error?.stack || error.stack;
        pending.reject(error);
      }
    }
  });

  socket.on("close", () => {
    if (!activeSessionId) {
      return;
    }

    const session = sessions.get(activeSessionId);
    if (!session) {
      return;
    }

    for (const pending of session.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Session '${activeSessionId}' disconnected`));
    }

    sessions.delete(activeSessionId);
    if (selectedSessionId === activeSessionId) {
      selectedSessionId = sessions.keys().next().value || null;
    }

    log(`disconnected ${activeSessionId}`);
  });
});

log(`bridge listening on ws://127.0.0.1:${BRIDGE_PORT}`);

const server = new McpServer({
  name: "construct-shader-graph",
  version: "1.0.0",
});

server.registerTool(
  "list_projects",
  {
    description: "List connected shader graph tabs registered with the local MCP bridge.",
    inputSchema: {},
    outputSchema: {
      projects: z.array(
        z.object({
          sessionId: z.string(),
          project: z.object({
            name: z.string(),
            version: z.string().optional(),
            author: z.string().optional(),
            category: z.string().optional(),
            description: z.string().optional(),
            shaderInfo: z.any().optional(),
          }),
          connectedAt: z.string(),
          updatedAt: z.string(),
          manifestVersion: z.string().nullable(),
          methodCount: z.number(),
          selected: z.boolean(),
        }),
      ),
      selectedSessionId: z.string().nullable(),
    },
  },
  async () => {
    const projects = [...sessions.values()].map(getSessionSummary);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ projects, selectedSessionId }, null, 2),
        },
      ],
      structuredContent: {
        projects,
        selectedSessionId,
      },
    };
  },
);

server.registerTool(
  "select_project",
  {
    description: "Choose which connected shader graph tab future MCP calls should target.",
    inputSchema: {
      sessionId: z.string().describe("Session id returned by list_projects."),
    },
    outputSchema: {
      sessionId: z.string(),
      project: z.any(),
    },
  },
  async ({ sessionId }) => {
    const session = ensureSession(sessionId);
    selectedSessionId = sessionId;
    const result = {
      sessionId,
      project: session.project,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  "get_project_manifest",
  {
    description: "Get the machine-readable API manifest for the selected project.",
    inputSchema: {
      sessionId: z.string().optional().describe("Optional session id; defaults to the selected project."),
    },
    outputSchema: {
      sessionId: z.string(),
      project: z.any(),
      manifest: z.any(),
    },
  },
  async ({ sessionId }) => {
    const session = sessionId ? ensureSession(sessionId) : ensureSelectedSession();
    const result = {
      sessionId: session.sessionId,
      project: session.project,
      manifest: session.manifest,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  "call_project_method",
  {
    description: "Call one method from the selected project's shaderGraphAPI and return its exact result.",
    inputSchema: {
      sessionId: z.string().optional().describe("Optional session id; defaults to the selected project."),
      method: z.string().describe("Manifest method path, for example nodes.create or shader.getInfo."),
      args: z.array(z.any()).optional().describe("Positional arguments to pass to the API method."),
    },
    outputSchema: {
      sessionId: z.string(),
      project: z.any(),
      method: z.string(),
      args: z.array(z.any()),
      durationMs: z.number(),
      result: z.any(),
    },
  },
  async ({ sessionId, method, args = [] }) => {
    const session = sessionId ? ensureSession(sessionId) : ensureSelectedSession();
    const response = await invokeSession(session, method, args);
    const result = {
      sessionId: session.sessionId,
      project: session.project,
      method,
      args,
      durationMs: response.durationMs ?? 0,
      result: response.result,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
