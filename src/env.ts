import process from "node:process";
import type { JevConfig, LlmConfig } from "./types.ts";

export function envJev(): JevConfig | undefined {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return undefined;
  return {
    apiKey,
    baseUrl: process.env.TYPESAFE_BASE_URL,
    model: process.env.JEVBRIDGE_JEV_MODEL,
  };
}

export function envLlm(): LlmConfig | undefined {
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
