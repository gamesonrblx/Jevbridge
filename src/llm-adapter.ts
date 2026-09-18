import { argmax, clamp01, expectedScore, flattenState, normalizeMap, peakedness } from "./normalize.ts";
import type {
  Answer,
  Answers,
  EvaluateResult,
  LlmConfig,
  Question,
  Questions,
  State,
} from "./types.ts";

export function systemOnePrompt(state: State, questions: Questions): string {
  const catalog = Object.entries(questions)
    .map(([id, q]) => formatQuestion(id, q))
    .join("\n\n");
  return [
    "You are a System One decision model. You do not write prose, plans, or code.",
    "Evaluate STATE against every QUESTION independently.",
    "Return a single JSON object: { \"answers\": { ... } }.",
    "Rules:",
    "- noul: { \"type\":\"noul\", \"noul\": number in [0,1] } = P(yes).",
    "- choice: { \"type\":\"choice\", \"choice\": option key, \"probabilities\": {key: p, ...}, \"confidence\": 0..1 }.",
    "  probabilities must include every option and sum to 1.",
    "- score: { \"type\":\"score\", \"score\": expected level index, \"probabilities\": {\"0\":p,...}, \"confidence\": 0..1, \"legend\": {\"0\":\"...\"} }.",
    "  probabilities cover every rubric level as string indexes.",
    "- Do not invent options or levels. Do not add explanations.",
    "",
    "STATE:",
    flattenState(state),
    "",
    "QUESTIONS:",
    catalog,
  ].join("\n");
}

function formatQuestion(id: string, q: Question): string {
  if (q.type === "noul") {
    return `- ${id} [noul] ${q.instructions}${q.criteria?.true ? `\n  yes: ${q.criteria.true}` : ""}${q.criteria?.false ? `\n  no: ${q.criteria.false}` : ""}`;
  }
  if (q.type === "choice") {
    const opts = Object.entries(q.criteria)
      .map(([k, v]) => `  - ${k}: ${v ?? k}`)
      .join("\n");
    return `- ${id} [choice] ${q.instructions}\n${opts}`;
  }
  const levels = q.criteria.map((label, i) => `  - ${i}: ${label}`).join("\n");
  return `- ${id} [score] ${q.instructions}\n${levels}`;
}

export function coerceAnswers(raw: unknown, questions: Questions): Answers {
  const root =
    raw && typeof raw === "object" && "answers" in raw
      ? (raw as { answers: unknown }).answers
      : raw;
  const bag = root && typeof root === "object" ? (root as Record<string, unknown>) : {};
  const answers: Answers = {};
  for (const [id, q] of Object.entries(questions)) {
    answers[id] = coerceOne(bag[id], q);
  }
  return answers;
}

function coerceOne(raw: unknown, q: Question): Answer {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (q.type === "noul") {
    const n = Number(obj.noul ?? obj.value ?? obj.probability);
    return { type: "noul", noul: clamp01(n) };
  }
  if (q.type === "choice") {
    const keys = Object.keys(q.criteria);
    const incoming =
      obj.probabilities && typeof obj.probabilities === "object"
        ? (obj.probabilities as Record<string, number>)
        : {};
    const filled = Object.fromEntries(
      keys.map((k) => [k, Number(incoming[k] ?? (obj.choice === k ? 1 : 0))]),
    );
    const probabilities = normalizeMap(filled);
    const picked =
      typeof obj.choice === "string" && keys.includes(obj.choice)
        ? obj.choice
        : argmax(probabilities);
    return {
      type: "choice",
      choice: picked,
      confidence: clamp01(Number(obj.confidence) || peakedness(Object.values(probabilities))),
      probabilities,
    };
  }
  const n = q.criteria.length;
  const incoming =
    obj.probabilities && typeof obj.probabilities === "object"
      ? (obj.probabilities as Record<string, number>)
      : {};
  const filled = Object.fromEntries(
    Array.from({ length: n }, (_, i) => [String(i), Number(incoming[String(i)] ?? 0)]),
  );
  const probabilities = normalizeMap(filled);
  const legend = Object.fromEntries(q.criteria.map((label, i) => [String(i), label]));
  const score =
    Number.isFinite(Number(obj.score)) ? Number(obj.score) : expectedScore(probabilities);
  return {
    type: "score",
    score,
    confidence: clamp01(Number(obj.confidence) || peakedness(Object.values(probabilities))),
    legend,
    probabilities,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM returned no JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

async function chatOpenAICompat(
  cfg: LlmConfig,
  prompt: string,
): Promise<{ text: string; input: number; output: number }> {
  const url = `${(cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err.slice(0, 280)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: body.choices?.[0]?.message?.content ?? "",
    input: body.usage?.prompt_tokens ?? 0,
    output: body.usage?.completion_tokens ?? 0,
  };
}

async function chatAnthropic(
  cfg: LlmConfig,
  prompt: string,
): Promise<{ text: string; input: number; output: number }> {
  const url = `${(cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 900,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 280)}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  return {
    text,
    input: body.usage?.input_tokens ?? 0,
    output: body.usage?.output_tokens ?? 0,
  };
}

export async function evaluateLlm(
  state: State,
  questions: Questions,
  cfg: LlmConfig,
): Promise<EvaluateResult> {
  const started = Date.now();
  const prompt = systemOnePrompt(state, questions);
  const chat =
    cfg.provider === "anthropic" ? chatAnthropic : chatOpenAICompat;
  const { text, input, output } = await chat(cfg, prompt);
  const answers = coerceAnswers(extractJson(text), questions);
  return {
    model: cfg.model,
    backend: "llm",
    answers,
    usage: {
      input_tokens: input,
      output_tokens: output,
      latency_ms: Date.now() - started,
    },
  };
}
