export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type State = string | JsonValue[] | { [key: string]: JsonValue };

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string | null; false?: string | null };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type Questions = Record<string, Question>;

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
};

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;
export type Answers = Record<string, Answer>;

export type BackendKind = "jev" | "llm" | "heuristic";
export type BackendRequest = BackendKind | "auto";

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
};

export type EvaluateResult = {
  model: string;
  backend: BackendKind;
  answers: Answers;
  usage: Usage;
};

export type LlmProviderId =
  | "openai"
  | "anthropic"
  | "xai"
  | "opencode"
  | "codex"
  | "generic";

export type LlmConfig = {
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export type JevConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

export type EvaluateRequest = {
  state: State;
  questions: Questions;
  backend?: BackendRequest;
  model?: string;
  jev?: JevConfig;
  llm?: LlmConfig;
};

export type GateAction = "execute" | "confirm" | "escalate" | "abort";

export type GateDecision = {
  action: GateAction;
  reason: string;
  confidence: number;
  choice?: string;
  destructive?: number;
};

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_JEV_MODEL = "jev-latest";
