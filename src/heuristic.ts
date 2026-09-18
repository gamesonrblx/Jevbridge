import { peakedness, overlap, tokenize, flattenState, softmax, clamp01 } from "./normalize.ts";
import type {
  Answer,
  Answers,
  EvaluateResult,
  Question,
  Questions,
  ScoreAnswer,
  State,
} from "./types.ts";

const YES = new Set([
  "yes",
  "true",
  "urgent",
  "refund",
  "duplicate",
  "safe",
  "ready",
  "complete",
  "done",
  "confirm",
  "requested",
  "pii",
  "blocked",
  "destructive",
  "delete",
  "charge",
  "failing",
  "asap",
  "immediately",
]);

const NO = new Set([
  "no",
  "false",
  "calm",
  "wait",
  "later",
  "unknown",
  "unrelated",
  "spam",
]);

function tokensFrom(state: State, extra = ""): Set<string> {
  return new Set(tokenize(`${flattenState(state)} ${extra}`));
}

function noulFrom(q: Extract<Question, { type: "noul" }>, bag: Set<string>): number {
  const inst = tokenize(q.instructions);
  const yesHint = tokenize(q.criteria?.true ?? "yes true");
  const noHint = tokenize(q.criteria?.false ?? "no false");
  const yesScore =
    overlap(inst, bag) * 0.35 + overlap(yesHint, bag) + [...bag].filter((t) => YES.has(t)).length * 0.15;
  const noScore = overlap(noHint, bag) + [...bag].filter((t) => NO.has(t)).length * 0.12;
  const raw = 0.42 + yesScore * 0.35 - noScore * 0.28;
  return clamp01(raw);
}

function choiceFrom(
  q: Extract<Question, { type: "choice" }>,
  bag: Set<string>,
  stateText: string,
): Answer {
  const keys = Object.keys(q.criteria);
  const lower = stateText.toLowerCase();
  const computerUse = keys.includes("click") && keys.includes("done");
  const alreadyDone = /already (reversed|refunded|complete)|goal complete/.test(lower);
  const logits = keys.map((key) => {
    const desc = q.criteria[key] ?? "";
    const corpus = tokenize(`${key} ${desc} ${q.instructions}`);
    let score = overlap(corpus, bag) * 3;
    if (lower.includes(key.toLowerCase())) score += 2.2;
    for (const t of tokenize(key)) {
      if (bag.has(t)) score += 1.4;
    }
    if (key === "other" || key === "abort" || key === "wait") score += 0.15;
    if (computerUse) {
      if (key === "click" && /refund|button|visible_controls|visible/.test(lower) && !alreadyDone) {
        score += 4.2;
      }
      if (key === "done" && !alreadyDone) score -= 2.4;
      if (key === "done" && alreadyDone) score += 5;
      if (key === "abort") score -= 1.2;
    }
    if (keys.includes("billing") && key === "billing" && /refund|charge|invoice|payout/.test(lower)) {
      score += 3.5;
    }
    if (keys.includes("run") && key === "run" && /rm -rf|force-push|drop /.test(lower)) {
      score -= 3;
    }
    return score;
  });
  const probs = softmax(logits, 0.55);
  const probabilities = Object.fromEntries(keys.map((k, i) => [k, probs[i] ?? 0]));
  const choice = keys.reduce((best, k) =>
    (probabilities[k] ?? 0) > (probabilities[best] ?? 0) ? k : best,
  );
  return {
    type: "choice",
    choice,
    confidence: peakedness(probs),
    probabilities,
  };
}

function scoreFrom(q: Extract<Question, { type: "score" }>, bag: Set<string>): ScoreAnswer {
  const levels = q.criteria;
  const logits = levels.map((label, i) => {
    const corpus = tokenize(`${label} ${q.instructions}`);
    return overlap(corpus, bag) * 2.6 + i * 0.08;
  });
  const probs = softmax(logits, 0.65);
  const probabilities = Object.fromEntries(probs.map((p, i) => [String(i), p]));
  const legend = Object.fromEntries(levels.map((label, i) => [String(i), label]));
  const score = probs.reduce((s, p, i) => s + p * i, 0);
  return {
    type: "score",
    score,
    confidence: peakedness(probs),
    legend,
    probabilities,
  };
}

export function evaluateHeuristic(state: State, questions: Questions): EvaluateResult {
  const started = Date.now();
  const stateText = flattenState(state);
  const bag = tokensFrom(state, Object.values(questions).map((q) => q.instructions).join(" "));
  const answers: Answers = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === "noul") answers[id] = { type: "noul", noul: noulFrom(q, bag) };
    else if (q.type === "choice") answers[id] = choiceFrom(q, bag, stateText);
    else answers[id] = scoreFrom(q, bag);
  }
  return {
    model: "jevbridge-heuristic",
    backend: "heuristic",
    answers,
    usage: {
      input_tokens: Math.ceil(stateText.length / 4),
      output_tokens: Object.keys(answers).length * 12,
      latency_ms: Date.now() - started,
    },
  };
}
