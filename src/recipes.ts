import { choice, noul, score } from "./questions.ts";
import { computerUseQuestions } from "./computer-use.ts";
import type { Questions, State } from "./types.ts";

export type Recipe = {
  id: string;
  title: string;
  blurb: string;
  state: State;
  questions: Questions;
};

export const RECIPES: Recipe[] = [
  {
    id: "support-route",
    title: "Support routing",
    blurb: "Fan out noul, choice, and score on one ticket. Code branches on the answers.",
    state: {
      ticket: {
        subject: "Duplicate charge",
        message:
          "I was charged twice for order A-104. Please refund the duplicate today. This is blocking payroll.",
      },
      order: {
        id: "A-104",
        charges: [
          { amount_usd: 49, status: "captured" },
          { amount_usd: 49, status: "captured" },
        ],
      },
      refund_policy: "Duplicate charges are eligible for an immediate refund.",
    },
    questions: {
      refund_requested: noul("Does the ticket request a refund?", {
        true: "Explicit refund, chargeback, or duplicate-charge language.",
        false: "No money movement requested.",
      }),
      department: choice("Which team should handle this?", {
        billing: "Payments, invoices, refunds, duplicate charges.",
        technical: "Bugs, outages, login, integrations.",
        account: "Profile, access, identity.",
        other: "Does not fit the other teams.",
      }),
      urgency: score("How time-sensitive is this?", [
        "Can wait a business week",
        "Should be handled today",
        "Blocking and needs action now",
      ]),
    },
  },
  {
    id: "computer-use",
    title: "Computer use",
    blurb: "Closed action set over a live UI observation. LLM plans. Jev picks the next click.",
    state: {
      goal: "Refund the duplicate charge on order A-104",
      app: "Billing Console",
      url: "https://console.internal/orders/A-104",
      visible_controls: [
        "Refund duplicate",
        "Email customer",
        "Open dispute",
        "Close ticket",
        "Order notes",
      ],
      focused: null,
      last_action: null,
      page: {
        customer: "Maya Chen",
        order: "A-104",
        charges: ["$49.00 captured", "$49.00 captured DUPLICATE"],
      },
    },
    questions: computerUseQuestions([
      "Refund duplicate",
      "Email customer",
      "Open dispute",
      "Close ticket",
      "Order notes",
    ]),
  },
  {
    id: "destructive-gate",
    title: "Destructive gate",
    blurb: "Before a coding agent runs a command, Jev scores blast radius and confidence-gates it.",
    state: {
      agent: "codex",
      cwd: "/srv/payments",
      proposed_command: "rm -rf ./data/ledger && git push --force origin main",
      user_goal: "Reset local test fixtures for the ledger service",
      git_status: "dirty, 14 files, uncommitted migration",
    },
    questions: {
      matches_goal: noul("Does the proposed command match the user goal?", {
        true: "Scoped to local test fixtures.",
        false: "Touches production, history, or unrelated paths.",
      }),
      is_destructive: noul("Is the command destructive or irreversible?", {
        true: "Deletes data, force-pushes, or drops schemas.",
        false: "Read-only or easily reversed.",
      }),
      next: choice("What should the agent do?", {
        run: "Safe and aligned — execute.",
        rewrite: "Too broad. Rewrite a narrower command.",
        ask: "Ask the user before touching anything.",
        abort: "Refuse. Blast radius is unacceptable.",
      }),
      blast_radius: score("How wide is the blast radius?", [
        "Local, reversible",
        "Repo-local but painful",
        "Shared environment",
        "Production or history rewrite",
      ]),
    },
  },
  {
    id: "compaction",
    title: "Context keep/drop",
    blurb: "Score every tool result in one fan-out. Keep verbatim. Drop stale. No LLM summary.",
    state: {
      goal: "Fix the failing auth test. Never edit generated clients.",
      tool_calls: [
        { id: "t1", tool: "Read", path: "src/auth/session.ts", preview: "export function session() { ... }" },
        { id: "t2", tool: "Read", path: "src/generated/api.ts", preview: "// generated — do not edit" },
        { id: "t3", tool: "Bash", command: "npm test -- auth", preview: "FAIL auth/session.test.ts" },
      ],
    },
    questions: {
      keep_session: noul("Is the session.ts read still needed for the failing auth test?"),
      keep_generated: noul("Is the generated client read still needed?"),
      keep_test_output: noul("Is the test output still needed?"),
      next_file: choice("Which file should the agent open next?", {
        session_test: "src/auth/session.test.ts",
        session_impl: "src/auth/session.ts",
        generated: "src/generated/api.ts",
        unrelated: "Something outside auth.",
      }),
    },
  },
];

export function recipeById(id: string): Recipe {
  return RECIPES.find((r) => r.id === id) ?? RECIPES[0]!;
}
