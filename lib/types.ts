export type ExecutionMode = "one_shot" | "multi_step_loop" | "event_triggered";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ProviderType =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "google"
  | "bedrock"
  | "openai_compatible"
  | "ollama";

export interface AgentLimits {
  max_steps: number;
  max_runtime_ms: number;
  max_tool_calls: number;
  max_tokens_per_run: number;
}

export interface Skill {
  label: string;
  description: string;
  try_first?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  execution_mode: ExecutionMode;
  provider_id: string;
  model: string;
  current_prompt_version: string;
  tools: string[];
  limits: AgentLimits;
  archived_at: string | null;
  created_at: string;
  intro: string[];
  skills: Skill[];
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string | null;
  key_prefix: string | null;
  models: string[];
  status: "active" | "error" | "disabled";
  created_at: string;
  last_used_at: string | null;
  byo: boolean;
}

export interface Run {
  id: string;
  agent_id: string;
  status: RunStatus;
  reason_code: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  step_count: number;
  tool_call_count: number;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TraceStep {
  seq: number;
  ts: string;
  type:
    | "started"
    | "llm_call"
    | "llm_result"
    | "tool_call"
    | "tool_result"
    | "completed"
    | "failed"
    | "cancelled";
  summary: string;
  detail?: unknown;
}
