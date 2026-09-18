import { randomUUID } from "node:crypto";
import process from "node:process";
import { evaluate } from "../evaluate.ts";
import { gate } from "../gate.ts";
import { computerUseQuestions, observationState, readAction } from "../computer-use.ts";
import { choice, noul, score } from "../questions.ts";
import type { EvaluateRequest, LlmConfig, State } from "../types.ts";
import {
  PROTOCOL_VERSION,
  promptText,
  type ContentBlock,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type SessionUpdate,
} from "./protocol.ts";

function envLlm(): LlmConfig | undefined {
  const provider = (process.env.JEVBRIDGE_LLM ?? "xai") as LlmConfig["provider"];
  const key =
    process.env.JEVBRIDGE_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENCODE_API_KEY;
  if (!key) return undefined;
  const models: Record<string, string> = {
    xai: "grok-4.5",
    openai: "gpt-4.1",
    anthropic: "claude-sonnet-4-5",
    opencode: "opencode-auto",
    codex: "gpt-5",
    generic: process.env.JEVBRIDGE_LLM_MODEL ?? "local-model",
  };
  const bases: Record<string, string> = {
    xai: "https://api.x.ai/v1",
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    opencode: "https://opencode.ai/zen/v1",
    codex: "https://api.openai.com/v1",
    generic: process.env.JEVBRIDGE_BASE_URL ?? "http://127.0.0.1:11434/v1",
  };
  return {
    provider,
    apiKey: key,
    model: process.env.JEVBRIDGE_LLM_MODEL ?? models[provider] ?? "grok-4.5",
    baseUrl: process.env.JEVBRIDGE_BASE_URL ?? bases[provider],
  };
}

function write(msg: JsonRpcResponse | JsonRpcNotification) {
  const json = JSON.stringify(msg);
  const payload = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
  process.stdout.write(payload);
}

function notify(method: string, params: unknown) {
  write({ jsonrpc: "2.0", method, params });
}

function reply(id: JsonRpcId, result: unknown) {
  write({ jsonrpc: "2.0", id, result });
}

function fail(id: JsonRpcId, code: number, message: string) {
  write({ jsonrpc: "2.0", id, error: { code, message } });
}

async function readLoop(onMessage: (msg: JsonRpcRequest | JsonRpcNotification) => Promise<void>) {
  let buffer = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    buffer = Buffer.concat([buffer, chunk as Buffer]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) break;
      const body = buffer.subarray(start, start + length).toString("utf8");
      buffer = buffer.subarray(start + length);
      const parsed = JSON.parse(body) as JsonRpcRequest | JsonRpcNotification;
      await onMessage(parsed);
    }
  }
}

export async function serveAcp() {
  const llm = envLlm();
  const jevKey = process.env.TYPESAFE_API_KEY;
  const sessions = new Map<string, { cwd?: string }>();

  await readLoop(async (msg) => {
    if (!("id" in msg) || msg.id === undefined) {
      if (msg.method === "session/cancel") return;
      return;
    }
    const req = msg as JsonRpcRequest;
    try {
      if (req.method === "initialize") {
        reply(req.id, {
          protocolVersion: PROTOCOL_VERSION,
          agentCapabilities: {
            loadSession: false,
            promptCapabilities: { image: false, audio: false, embeddedContext: true },
          },
          agentInfo: { name: "jevbridge", title: "Jevbridge", version: "0.1.0" },
          authMethods: [],
        });
        return;
      }
      if (req.method === "authenticate") {
        reply(req.id, {});
        return;
      }
      if (req.method === "session/new") {
        const sessionId = randomUUID();
        const params = (req.params ?? {}) as { cwd?: string };
        sessions.set(sessionId, { cwd: params.cwd });
        reply(req.id, { sessionId });
        return;
      }
      if (req.method === "session/prompt") {
        const params = req.params as { sessionId: string; prompt: ContentBlock[] };
        const text = promptText(params.prompt);
        const computer = /click|refund|browser|screen|desktop|computer use|gui/i.test(text);
        const evalReq: EvaluateRequest = {
          state: computer
            ? observationState({
                goal: text,
                app: "editor",
                visible: ["Continue", "Cancel", "Back"],
              })
            : ({ user_prompt: text, cwd: sessions.get(params.sessionId)?.cwd ?? null } as State),
          questions: computer
            ? computerUseQuestions(["Continue", "Cancel", "Back"])
            : {
                task: choice("What is this turn?", {
                  question: "Explanation or answer.",
                  code_edit: "Change code.",
                  computer_use: "Act on a GUI or browser.",
                  terminal: "Run a shell command.",
                }),
                needs_permission: noul("Should the agent ask before acting?"),
                risk: score("How risky is an unsupervised action?", [
                  "Read-only",
                  "Local reversible edit",
                  "Shared or production effect",
                ]),
              },
          backend: "auto",
          jev: jevKey ? { apiKey: jevKey } : undefined,
          llm,
        };

        notify("session/update", {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "jev_decide",
            title: "Jevbridge decide",
            kind: "other",
            status: "in_progress",
          } satisfies SessionUpdate,
        });

        const decision = await evaluate(evalReq);
        const g = gate(decision.answers, {
          choiceId: computer ? "next_action" : "task",
          destructiveId: computer ? "is_destructive" : undefined,
        });

        notify("session/update", {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "jev_decide",
            status: "completed",
            content: [
              {
                type: "content",
                content: {
                  type: "text",
                  text: JSON.stringify({ answers: decision.answers, gate: g }, null, 2),
                },
              },
            ],
          } satisfies SessionUpdate,
        });

        const line = computer
          ? `Next action ${readAction(decision.answers)} · gate ${g.action} · ${g.reason}`
          : `Task routed · gate ${g.action} · ${g.reason}`;

        notify("session/update", {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: line },
          } satisfies SessionUpdate,
        });

        reply(req.id, { stopReason: "end_turn" });
        return;
      }
      fail(req.id, -32601, `Method not found: ${req.method}`);
    } catch (err) {
      fail(req.id, -32603, err instanceof Error ? err.message : "Internal error");
    }
  });
}
