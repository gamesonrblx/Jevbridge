import process from "node:process";
import {
  MCP_PROMPTS,
  MCP_RESOURCES,
  MCP_TOOLS,
  callMcpTool,
  getMcpPrompt,
  readMcpResource,
} from "./tools.ts";
import {
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
  negotiateVersion,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./protocol.ts";

function write(msg: JsonRpcResponse | JsonRpcNotification) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function reply(id: JsonRpcId, result: unknown) {
  write({ jsonrpc: "2.0", id, result });
}

function fail(id: JsonRpcId, code: number, message: string) {
  write({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function handleMcpRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = req;
  try {
    if (method === "initialize") {
      const requested = (params as { protocolVersion?: string } | undefined)?.protocolVersion;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(requested),
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        },
      };
    }
    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    }
    if (method === "tools/call") {
      const call = (params ?? {}) as { name?: string; arguments?: unknown };
      if (!call.name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "name is required" } };
      }
      const result = await callMcpTool(call.name, call.arguments ?? {});
      return { jsonrpc: "2.0", id, result };
    }
    if (method === "resources/list") {
      return { jsonrpc: "2.0", id, result: { resources: MCP_RESOURCES } };
    }
    if (method === "resources/templates/list") {
      return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
    }
    if (method === "resources/read") {
      const uri = (params as { uri?: string } | undefined)?.uri;
      if (!uri) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "uri is required" } };
      }
      return { jsonrpc: "2.0", id, result: { contents: [readMcpResource(uri)] } };
    }
    if (method === "prompts/list") {
      return { jsonrpc: "2.0", id, result: { prompts: MCP_PROMPTS } };
    }
    if (method === "prompts/get") {
      const p = (params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!p.name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "name is required" } };
      }
      return { jsonrpc: "2.0", id, result: getMcpPrompt(p.name, p.arguments) };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : "Internal error" },
    };
  }
}

async function readLoop(onLine: (line: string) => Promise<void>) {
  let buffer = "";
  for await (const chunk of process.stdin) {
    buffer += typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8");
    while (true) {
      const nl = buffer.indexOf("\n");
      if (nl < 0) break;
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.trim().length === 0) continue;
      await onLine(line);
    }
  }
}

export async function serveMcp() {
  await readLoop(async (line) => {
    let parsed: JsonRpcRequest | JsonRpcNotification;
    try {
      parsed = JSON.parse(line) as JsonRpcRequest | JsonRpcNotification;
    } catch {
      write({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }
    if (!("id" in parsed) || parsed.id === undefined) return;
    const response = await handleMcpRequest(parsed as JsonRpcRequest);
    write(response);
  });
}
