import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from "./types.ts";

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
