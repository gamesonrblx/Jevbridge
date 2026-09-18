import { choice, noul, score } from "./questions.ts";
import type { Answers, ChoiceAnswer, Questions } from "./types.ts";

export const COMPUTER_USE_ACTIONS = [
  "click",
  "type",
  "scroll",
  "wait",
  "screenshot",
  "done",
  "abort",
] as const;

export type ComputerUseAction = (typeof COMPUTER_USE_ACTIONS)[number];

export type ComputerUseObservation = {
  goal: string;
  app: string;
  url?: string;
  visible: string[];
  focused?: string | null;
  lastAction?: string | null;
  notes?: string;
};

export function computerUseQuestions(targets: string[]): Questions {
  const targetCriteria: Record<string, string | null> = {
    none: "No on-screen target needed (wait, screenshot, done, abort).",
  };
  for (const t of targets) targetCriteria[slug(t)] = t;
  return {
    next_action: choice("Which single next computer-use action should the agent take?", {
      click: "Click a visible control that advances the goal.",
      type: "Type into the focused or relevant field.",
      scroll: "Scroll to reveal a control that is not yet visible.",
      wait: "Wait for the UI to settle.",
      screenshot: "Capture a fresh observation before acting.",
      done: "The user goal is already complete.",
      abort: "Stop. The action is unsafe, blocked, or impossible.",
    }),
    target: choice("Which on-screen target should that action use?", targetCriteria),
    is_safe: noul("Is this next action safe to run without extra confirmation?", {
      true: "Read-only or clearly reversible.",
      false: "Submits, pays, deletes, or is hard to undo.",
    }),
    is_destructive: noul("Would this action spend money, delete data, or submit a form?", {
      true: "Refund, pay, delete, send, overwrite.",
      false: "Navigate, inspect, or fill a draft.",
    }),
    goal_progress: score("How close is the current observation to the user goal?", [
      "No progress — wrong surface",
      "Relevant app or page is open",
      "The correct control is visible",
      "The action is primed and safe",
      "Goal complete",
    ]),
  };
}

export function slug(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return s.length > 0 ? s : "target";
}

export function resolveTarget(answers: Answers, visible: string[]): string | null {
  const target = answers.target;
  if (!target || target.type !== "choice") return null;
  if (target.choice === "none") return null;
  const match = visible.find((v) => slug(v) === target.choice);
  return match ?? visible[0] ?? null;
}

export function readAction(answers: Answers): ComputerUseAction {
  const next = answers.next_action as ChoiceAnswer | undefined;
  const value = next?.choice;
  if (value && (COMPUTER_USE_ACTIONS as readonly string[]).includes(value)) {
    return value as ComputerUseAction;
  }
  return "wait";
}

export function observationState(obs: ComputerUseObservation) {
  return {
    goal: obs.goal,
    app: obs.app,
    url: obs.url ?? null,
    visible_controls: obs.visible,
    focused: obs.focused ?? null,
    last_action: obs.lastAction ?? null,
    notes: obs.notes ?? null,
  };
}
