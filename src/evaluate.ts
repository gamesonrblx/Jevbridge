import { evaluateJev } from "./client.ts";
import { evaluateHeuristic } from "./heuristic.ts";
import { evaluateLlm } from "./llm-adapter.ts";
import type { EvaluateRequest, EvaluateResult } from "./types.ts";

export async function evaluate(req: EvaluateRequest): Promise<EvaluateResult> {
  const backend = resolveBackend(req);
  if (backend === "heuristic") return evaluateHeuristic(req.state, req.questions);
  if (backend === "jev") {
    if (!req.jev?.apiKey) throw new Error("TYPESAFE_API_KEY is required for the Jev backend");
    return evaluateJev(req.state, req.questions, req.jev);
  }
  if (!req.llm?.apiKey) throw new Error("An LLM API key is required for the adapter backend");
  return evaluateLlm(req.state, req.questions, req.llm);
}

export function resolveBackend(req: EvaluateRequest): EvaluateResult["backend"] {
  if (req.backend && req.backend !== "auto") return req.backend;
  if (req.jev?.apiKey) return "jev";
  if (req.llm?.apiKey) return "llm";
  return "heuristic";
}
