export type ExecutionMode = "one_shot" | "multi_step_loop" | "event_triggered";

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
