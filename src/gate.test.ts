import assert from "node:assert/strict";
import { test } from "node:test";
import { gate } from "./gate.ts";
import type { Answers } from "./types.ts";

test("peaked safe choice executes", () => {
  const answers: Answers = {
    next_action: {
      type: "choice",
      choice: "click",
      confidence: 0.91,
      probabilities: { click: 0.91, abort: 0.09 },
    },
  };
  assert.equal(gate(answers, { choiceId: "next_action" }).action, "execute");
});

test("destructive mid-confidence confirms", () => {
  const answers: Answers = {
    next_action: {
      type: "choice",
      choice: "click",
      confidence: 0.7,
      probabilities: { click: 0.7, abort: 0.3 },
    },
    is_destructive: { type: "noul", noul: 0.84 },
  };
  assert.equal(
    gate(answers, { choiceId: "next_action", destructiveId: "is_destructive" }).action,
    "confirm",
  );
});

test("abort choice aborts", () => {
  const answers: Answers = {
    next_action: {
      type: "choice",
      choice: "abort",
      confidence: 0.95,
      probabilities: { abort: 0.95, click: 0.05 },
    },
  };
  assert.equal(gate(answers, { choiceId: "next_action" }).action, "abort");
});
