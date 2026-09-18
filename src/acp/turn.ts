import { computerUseQuestions, observationState, readAction, resolveTarget } from "../computer-use.ts";
import { evaluateHeuristic } from "../heuristic.ts";
import { gate } from "../gate.ts";
import { choice, noul, score } from "../questions.ts";
import type { EvaluateResult, State } from "../types.ts";
import type { SessionUpdate } from "./protocol.ts";

export type AcpTurnEvent = {
  method: "session/update";
  params: { sessionId: string; update: SessionUpdate };
};

export type AcpTurnResult = {
  events: AcpTurnEvent[];
  stopReason: "end_turn";
  decision: EvaluateResult;
};

function push(
  events: AcpTurnEvent[],
  sessionId: string,
  update: SessionUpdate,
): void {
  events.push({ method: "session/update", params: { sessionId, update } });
}

export function runDecisionTurn(input: {
  sessionId: string;
  prompt: string;
  state?: State;
}): AcpTurnResult {
  const events: AcpTurnEvent[] = [];
  const sessionId = input.sessionId;
  const state =
    input.state ??
    ({
      user_prompt: input.prompt,
      agent_role: "coding-and-computer-use",
    } satisfies State);

  push(events, sessionId, {
    sessionUpdate: "plan",
    entries: [
      { content: "Ask Jev what kind of turn this is", priority: "high", status: "in_progress" },
      { content: "Confidence-gate before tools or computer use", priority: "high", status: "pending" },
      { content: "Let the LLM generate only if Jev says to", priority: "medium", status: "pending" },
    ],
  });

  const toolId = "jev_decide";
  push(events, sessionId, {
    sessionUpdate: "tool_call",
    toolCallId: toolId,
    title: "Jevbridge decide",
    kind: "other",
    status: "in_progress",
  });

  const looksComputer =
    /click|refund|browser|screen|ui|desktop|computer use/i.test(input.prompt);
  const decision = looksComputer
    ? evaluateHeuristic(
        typeof state === "object" && state && "visible_controls" in state
          ? state
          : observationState({
              goal: input.prompt,
              app: "Unknown",
              visible: ["Continue", "Cancel", "Back"],
            }),
        computerUseQuestions(["Continue", "Cancel", "Back"]),
      )
    : evaluateHeuristic(state, {
        task: choice("What is this turn?", {
          question: "The user wants an explanation or answer.",
          code_edit: "The user wants code changed.",
          computer_use: "The user wants a GUI or browser acted on.",
          terminal: "The user wants a shell command run.",
        }),
        needs_permission: noul("Should the agent ask before acting?"),
        risk: score("How risky is an unsupervised action?", [
          "Read-only",
          "Local reversible edit",
          "Shared or production effect",
        ]),
      });

  const decisionGate = gate(decision.answers, {
    choiceId: looksComputer ? "next_action" : "task",
    destructiveId: looksComputer ? "is_destructive" : undefined,
    noulId: looksComputer ? "is_safe" : "needs_permission",
  });

  const summary = JSON.stringify(
    {
      backend: decision.backend,
      answers: decision.answers,
      gate: decisionGate,
      action: looksComputer ? readAction(decision.answers) : undefined,
      target: looksComputer
        ? resolveTarget(decision.answers, ["Continue", "Cancel", "Back"])
        : undefined,
    },
    null,
    2,
  );

  push(events, sessionId, {
    sessionUpdate: "tool_call_update",
    toolCallId: toolId,
    status: "completed",
    content: [{ type: "content", content: { type: "text", text: summary } }],
  });

  const thought =
    decisionGate.action === "execute"
      ? "Jev is peaked. Proceed."
      : decisionGate.action === "confirm"
        ? "Jev wants a permission prompt before the tool runs."
        : decisionGate.action === "abort"
          ? "Jev aborted. Do not run the tool."
          : "Jev is uncertain. Escalate to the generating LLM.";

  push(events, sessionId, {
    sessionUpdate: "agent_thought_chunk",
    content: { type: "text", text: thought },
  });

  const message =
    decisionGate.action === "abort"
      ? `Stopped by Jevbridge (${decisionGate.reason})`
      : looksComputer
        ? `Next computer-use step: ${readAction(decision.answers)} — ${decisionGate.reason}`
        : `Routed as ${(decision.answers.task && decision.answers.task.type === "choice" ? decision.answers.task.choice : "task")} with gate ${decisionGate.action}.`;

  push(events, sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: message },
  });

  return { events, stopReason: "end_turn", decision };
}
