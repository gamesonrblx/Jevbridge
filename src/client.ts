import { coerceAnswers } from "./llm-adapter.ts";
import { DEFAULT_JEV_MODEL, TYPESAFE_ENDPOINT, type EvaluateResult, type JevConfig, type Questions, type State } from "./types.ts";

export async function evaluateJev(
  state: State,
  questions: Questions,
  cfg: JevConfig,
): Promise<EvaluateResult> {
  const started = Date.now();
  const model = cfg.model ?? DEFAULT_JEV_MODEL;
  const url = cfg.baseUrl ?? TYPESAFE_ENDPOINT;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model, state, questions }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jev error ${res.status}: ${err.slice(0, 280)}`);
  }
  const body = (await res.json()) as {
    model?: string;
    answers?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    model: body.model ?? model,
    backend: "jev",
    answers: coerceAnswers({ answers: body.answers }, questions),
    usage: {
      input_tokens: body.usage?.input_tokens ?? 0,
      output_tokens: body.usage?.output_tokens ?? 0,
      latency_ms: Date.now() - started,
    },
  };
}
