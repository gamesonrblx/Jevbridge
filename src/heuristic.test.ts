import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateHeuristic } from "./heuristic.ts";
import { recipeById } from "./recipes.ts";
import { gate } from "./gate.ts";
import { readAction } from "./computer-use.ts";

test("support recipe returns all three primitives", () => {
  const recipe = recipeById("support-route");
  const result = evaluateHeuristic(recipe.state, recipe.questions);
  assert.equal(result.answers.refund_requested?.type, "noul");
  assert.equal(result.answers.department?.type, "choice");
  assert.equal(result.answers.urgency?.type, "score");
  if (result.answers.department?.type === "choice") {
    assert.equal(result.answers.department.choice, "billing");
  }
  if (result.answers.refund_requested?.type === "noul") {
    assert.ok(result.answers.refund_requested.noul > 0.5);
  }
});

test("computer-use recipe prefers a click on refund", () => {
  const recipe = recipeById("computer-use");
  const result = evaluateHeuristic(recipe.state, recipe.questions);
  assert.equal(readAction(result.answers), "click");
  const g = gate(result.answers, {
    choiceId: "next_action",
    destructiveId: "is_destructive",
  });
  assert.ok(g.action === "confirm" || g.action === "execute");
});

test("destructive command recipe does not run", () => {
  const recipe = recipeById("destructive-gate");
  const result = evaluateHeuristic(recipe.state, recipe.questions);
  const g = gate(result.answers, {
    choiceId: "next",
    destructiveId: "is_destructive",
  });
  assert.notEqual(g.action, "execute");
});
