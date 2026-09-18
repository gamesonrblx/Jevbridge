export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } }
  | { type: "image"; data: string; mimeType: string };

export type SessionUpdate =
  | {
      sessionUpdate: "agent_message_chunk";
      content: { type: "text"; text: string };
    }
  | {
      sessionUpdate: "agent_thought_chunk";
      content: { type: "text"; text: string };
    }
  | {
      sessionUpdate: "tool_call";
      toolCallId: string;
      title: string;
      kind?: string;
      status?: "pending" | "in_progress" | "completed" | "failed";
    }
  | {
      sessionUpdate: "tool_call_update";
      toolCallId: string;
      status?: "pending" | "in_progress" | "completed" | "failed";
      content?: { type: "content"; content: { type: "text"; text: string } }[];
    }
  | {
      sessionUpdate: "plan";
      entries: { content: string; priority: "high" | "medium" | "low"; status: string }[];
    };

export const PROTOCOL_VERSION = 1;

export function promptText(blocks: ContentBlock[] | undefined): string {
  if (!blocks) return "";
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "resource") return b.resource.text ?? b.resource.uri;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
