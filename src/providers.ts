import type { LlmProviderId } from "./types.ts";

export type ProviderCatalogEntry = {
  id: LlmProviderId;
  name: string;
  tools: string[];
  defaultModel: string;
  baseUrl: string;
  apiKeyEnv: string;
  notes: string;
};

export const PROVIDERS: ProviderCatalogEntry[] = [
  {
    id: "xai",
    name: "Grok (xAI)",
    tools: ["Grok", "Grok Build"],
    defaultModel: "grok-4.5",
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    notes: "OpenAI-compatible Chat Completions. Default live adapter in this playground.",
  },
  {
    id: "anthropic",
    name: "Claude",
    tools: ["Claude Code", "Anthropic API"],
    defaultModel: "claude-sonnet-4-5",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    notes: "Messages API. Jevbridge maps System One JSON onto a single tool-free response.",
  },
  {
    id: "openai",
    name: "OpenAI",
    tools: ["ChatGPT", "API"],
    defaultModel: "gpt-4.1",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    notes: "Chat Completions + JSON response_format.",
  },
  {
    id: "codex",
    name: "Codex",
    tools: ["Codex CLI", "OpenAI Codex"],
    defaultModel: "gpt-5",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    notes: "Same wire as OpenAI. Point Codex at the ACP stdio adapter.",
  },
  {
    id: "opencode",
    name: "OpenCode",
    tools: ["OpenCode", "opencode.ai"],
    defaultModel: "opencode-auto",
    baseUrl: "https://opencode.ai/zen/v1",
    apiKeyEnv: "OPENCODE_API_KEY",
    notes: "OpenAI-compatible. Set JEVBRIDGE_BASE_URL if you self-host.",
  },
  {
    id: "generic",
    name: "OpenAI-compatible",
    tools: ["Ollama", "Together", "vLLM", "LiteLLM"],
    defaultModel: "local-model",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyEnv: "JEVBRIDGE_API_KEY",
    notes: "Any /v1/chat/completions endpoint. Set JEVBRIDGE_BASE_URL and JEVBRIDGE_LLM_MODEL.",
  },
];

export function providerById(id: LlmProviderId): ProviderCatalogEntry {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1]!;
}
