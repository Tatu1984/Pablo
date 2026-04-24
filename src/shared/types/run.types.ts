export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

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
