import type { ChoiceQuestion, NoulQuestion, Question, Questions, ScoreQuestion } from "./types.ts";

export function noul(
  instructions: string,
  criteria?: NoulQuestion["criteria"],
): NoulQuestion {
  return { type: "noul", instructions, criteria };
}

export function choice(
  instructions: string,
  criteria: Record<string, string | null>,
): ChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

export function score(instructions: string, criteria: string[]): ScoreQuestion {
  return { type: "score", instructions, criteria };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function parseQuestion(id: string, raw: unknown): Question {
  const q = asRecord(raw, `questions.${id}`);
  const type = q.type;
  const instructions = q.instructions;
  if (typeof instructions !== "string" || instructions.trim().length === 0) {
    throw new Error(`questions.${id}.instructions must be a non-empty string`);
  }
  if (type === "noul") {
    const criteria = q.criteria;
    if (criteria == null) return { type: "noul", instructions };
    const rec = asRecord(criteria, `questions.${id}.criteria`);
    return {
      type: "noul",
      instructions,
      criteria: {
        true: typeof rec.true === "string" ? rec.true : null,
        false: typeof rec.false === "string" ? rec.false : null,
      },
    };
  }
  if (type === "choice") {
    const rec = asRecord(q.criteria, `questions.${id}.criteria`);
    const criteria: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(rec)) {
      if (value != null && typeof value !== "string") {
        throw new Error(`questions.${id}.criteria.${key} must be a string or null`);
      }
      criteria[key] = value == null ? null : value;
    }
    if (Object.keys(criteria).length < 2) {
      throw new Error(`questions.${id} needs at least two choice criteria`);
    }
    return { type: "choice", instructions, criteria };
  }
  if (type === "score") {
    if (!Array.isArray(q.criteria) || q.criteria.some((item) => typeof item !== "string")) {
      throw new Error(`questions.${id}.criteria must be an array of rubric strings`);
    }
    if (q.criteria.length < 2) {
      throw new Error(`questions.${id} needs at least two score rubric entries`);
    }
    return { type: "score", instructions, criteria: q.criteria as string[] };
  }
  throw new Error(`questions.${id}.type must be noul, choice, or score`);
}

export function parseQuestions(raw: unknown): Questions {
  const rec = asRecord(raw, "questions");
  const questions: Questions = {};
  for (const [id, value] of Object.entries(rec)) {
    questions[id] = parseQuestion(id, value);
  }
  if (Object.keys(questions).length === 0) {
    throw new Error("questions must not be empty");
  }
  return questions;
}
