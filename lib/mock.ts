// Placeholder data so the UI is navigable without a live control-plane API.
// Replace with fetches against /v1/... once the Fastify API is reachable.

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

export const PROVIDER_TYPES: {
  type: ProviderType;
  label: string;
  description: string;
  default_base_url?: string;
  key_label?: string;
  extra_fields?: { name: string; label: string; placeholder?: string }[];
}[] = [
  {
    type: "openrouter",
    label: "OpenRouter",
    description: "One key, hundreds of models. Default gateway.",
    default_base_url: "https://openrouter.ai/api/v1",
    key_label: "OpenRouter API key",
  },
  {
    type: "openai",
    label: "OpenAI",
    description: "GPT-4o, o-series, and future OpenAI models.",
    default_base_url: "https://api.openai.com/v1",
    key_label: "OpenAI API key",
    extra_fields: [{ name: "org_id", label: "Org ID (optional)", placeholder: "org_…" }],
  },
  {
    type: "anthropic",
    label: "Anthropic",
    description: "Claude 4.x family (Opus, Sonnet, Haiku).",
    default_base_url: "https://api.anthropic.com",
    key_label: "Anthropic API key",
  },
  {
    type: "google",
    label: "Google AI / Vertex",
    description: "Gemini family.",
    default_base_url: "https://generativelanguage.googleapis.com",
    key_label: "API key",
  },
  {
    type: "bedrock",
    label: "AWS Bedrock",
    description: "Cross-account IAM to your Bedrock-enabled account.",
    key_label: "Access key ID",
    extra_fields: [
      { name: "region", label: "Region", placeholder: "us-east-1" },
      { name: "role_arn", label: "Role ARN", placeholder: "arn:aws:iam::…" },
    ],
  },
  {
    type: "openai_compatible",
    label: "OpenAI-compatible",
    description: "Any OpenAI-style endpoint (Together, Groq, Fireworks, vLLM…).",
    key_label: "API key",
    extra_fields: [
      {
        name: "base_url",
        label: "Base URL",
        placeholder: "https://api.together.xyz/v1",
      },
    ],
  },
  {
    type: "ollama",
    label: "Ollama / self-hosted",
    description: "On-prem models exposed via an OpenAI-style shim.",
    default_base_url: "http://localhost:11434/v1",
    key_label: "API key (optional)",
  },
];

export const PROVIDERS: Provider[] = [
  {
    id: "prov_01",
    name: "OpenRouter (default)",
    type: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    key_prefix: "sk-or-v1-",
    models: [
      "minimax/minimax-m2.5:free",
      "openai/gpt-4o-mini",
      "anthropic/claude-haiku-4.5",
      "google/gemini-2.0-flash",
      "meta/llama-3.1-70b-instruct",
    ],
    status: "active",
    created_at: "2026-02-01T08:00:00Z",
    last_used_at: "2026-04-24T07:12:00Z",
    byo: false,
  },
  {
    id: "prov_02",
    name: "OpenAI — production",
    type: "openai",
    base_url: "https://api.openai.com/v1",
    key_prefix: "sk-proj-",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    status: "active",
    created_at: "2026-03-10T10:00:00Z",
    last_used_at: "2026-04-22T15:30:00Z",
    byo: true,
  },
  {
    id: "prov_03",
    name: "Anthropic",
    type: "anthropic",
    base_url: "https://api.anthropic.com",
    key_prefix: "sk-ant-",
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
    status: "active",
    created_at: "2026-03-15T11:00:00Z",
    last_used_at: "2026-04-23T14:00:00Z",
    byo: true,
  },
  {
    id: "prov_04",
    name: "Ollama (staging LAN)",
    type: "ollama",
    base_url: "http://10.0.0.42:11434/v1",
    key_prefix: null,
    models: ["llama3.1:70b", "qwen2.5:32b"],
    status: "active",
    created_at: "2026-04-05T14:00:00Z",
    last_used_at: null,
    byo: true,
  },
];

export function allModels(): { provider: Provider; model: string }[] {
  return PROVIDERS.filter((p) => p.status !== "disabled").flatMap((p) =>
    p.models.map((m) => ({ provider: p, model: m })),
  );
}

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

export const AGENTS: Agent[] = [
  {
    id: "agent_01HS3Y7K2M4NQ",
    name: "Atlas",
    role: "Sales Analyst",
    description: "Summarises orders, refunds, and CRM pipeline movement.",
    execution_mode: "one_shot",
    provider_id: "prov_01",
    model: "minimax/minimax-m2.5:free",
    current_prompt_version: "v4",
    tools: ["http.request", "json.transform"],
    limits: {
      max_steps: 12,
      max_runtime_ms: 60000,
      max_tool_calls: 20,
      max_tokens_per_run: 40000,
    },
    archived_at: null,
    created_at: "2026-03-01T09:12:00Z",
    intro: [
      "Hey! I'm Atlas, your sales analyst. Ask me about yesterday's orders, trends, or plug me into your CRM.",
      "Here are a few skills to get you started, pick one below.",
    ],
    skills: [
      {
        label: "Summarise yesterday's sales",
        description: "Pull yesterday's orders, total revenue, and top SKUs.",
        try_first: true,
      },
      {
        label: "Week-over-week revenue",
        description: "Compare this week to last and highlight the movers.",
      },
      {
        label: "Flag unusual refunds",
        description: "Scan refunds and surface anything outside normal bounds.",
      },
    ],
  },
  {
    id: "agent_01HS3Y7K5PQRS",
    name: "Triage",
    role: "Support Router",
    description: "Classifies inbound tickets and routes them to the right queue.",
    execution_mode: "event_triggered",
    provider_id: "prov_03",
    model: "claude-haiku-4-5",
    current_prompt_version: "v12",
    tools: ["http.request", "webhook.trigger", "json.transform", "memory.read", "memory.write"],
    limits: {
      max_steps: 20,
      max_runtime_ms: 90000,
      max_tool_calls: 30,
      max_tokens_per_run: 60000,
    },
    archived_at: null,
    created_at: "2026-02-14T14:02:00Z",
    intro: [
      "I'm Triage. Paste a ticket and I'll classify, prioritise, and route it to the right queue.",
      "Pick a canned skill, or just describe the ticket below.",
    ],
    skills: [
      {
        label: "Classify a new ticket",
        description: "Assign a category, priority, and next queue.",
        try_first: true,
      },
      {
        label: "Draft an acknowledgement",
        description: "First-response copy in your brand voice.",
      },
      {
        label: "Escalate to on-call",
        description: "Compose a PagerDuty page with the right context.",
      },
    ],
  },
  {
    id: "agent_01HS3Y7K9TVWX",
    name: "Pulse",
    role: "Metrics Reporter",
    description: "Pulls warehouse metrics and composes digests.",
    execution_mode: "multi_step_loop",
    provider_id: "prov_04",
    model: "llama3.1:70b",
    current_prompt_version: "v2",
    tools: ["http.request", "json.transform"],
    limits: {
      max_steps: 30,
      max_runtime_ms: 180000,
      max_tool_calls: 50,
      max_tokens_per_run: 120000,
    },
    archived_at: null,
    created_at: "2026-04-05T11:40:00Z",
    intro: [
      "Pulse here. I pull weekly metrics from the warehouse and compose a digest.",
      "Kick me off with a pre-set routine or ask for something ad-hoc.",
    ],
    skills: [
      {
        label: "Run the weekly digest",
        description: "Warehouse query + stakeholder email, one pass.",
        try_first: true,
      },
      {
        label: "Diff against last week",
        description: "Surface any metric that moved more than 10%.",
      },
      {
        label: "Draft a board update",
        description: "One-page board memo from the raw numbers.",
      },
    ],
  },
];

export const RUNS: Run[] = [
  {
    id: "run_01HSAAAA1",
    agent_id: "agent_01HS3Y7K2M4NQ",
    status: "completed",
    reason_code: null,
    tokens_in: 2_120,
    tokens_out: 488,
    cost_cents: 0,
    step_count: 4,
    tool_call_count: 2,
    queued_at: "2026-04-23T06:00:00Z",
    started_at: "2026-04-23T06:00:01Z",
    finished_at: "2026-04-23T06:00:11Z",
  },
  {
    id: "run_01HSAAAA2",
    agent_id: "agent_01HS3Y7K2M4NQ",
    status: "failed",
    reason_code: "tool_failure",
    tokens_in: 960,
    tokens_out: 120,
    cost_cents: 0,
    step_count: 2,
    tool_call_count: 1,
    queued_at: "2026-04-22T06:00:00Z",
    started_at: "2026-04-22T06:00:01Z",
    finished_at: "2026-04-22T06:00:06Z",
  },
  {
    id: "run_01HSAAAA3",
    agent_id: "agent_01HS3Y7K5PQRS",
    status: "running",
    reason_code: null,
    tokens_in: 1_402,
    tokens_out: 0,
    cost_cents: 0,
    step_count: 3,
    tool_call_count: 2,
    queued_at: "2026-04-23T10:14:44Z",
    started_at: "2026-04-23T10:14:45Z",
    finished_at: null,
  },
  {
    id: "run_01HSAAAA4",
    agent_id: "agent_01HS3Y7K9TVWX",
    status: "queued",
    reason_code: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_cents: 0,
    step_count: 0,
    tool_call_count: 0,
    queued_at: "2026-04-23T10:15:01Z",
    started_at: null,
    finished_at: null,
  },
];

export const TRACE: Record<string, TraceStep[]> = {
  run_01HSAAAA1: [
    { seq: 1, ts: "2026-04-23T06:00:01Z", type: "started", summary: "Run started" },
    {
      seq: 2,
      ts: "2026-04-23T06:00:02Z",
      type: "llm_call",
      summary: "LLM call — plan next step",
      detail: { model: "minimax/minimax-m2.5:free", temperature: 0.2 },
    },
    {
      seq: 3,
      ts: "2026-04-23T06:00:03Z",
      type: "llm_result",
      summary: "Planned tool call: http.request",
    },
    {
      seq: 4,
      ts: "2026-04-23T06:00:04Z",
      type: "tool_call",
      summary: "http.request → GET /orders?day=2026-04-22",
    },
    {
      seq: 5,
      ts: "2026-04-23T06:00:07Z",
      type: "tool_result",
      summary: "200 OK, 1.2KB JSON body",
    },
    {
      seq: 6,
      ts: "2026-04-23T06:00:08Z",
      type: "llm_call",
      summary: "LLM call — summarise orders",
    },
    {
      seq: 7,
      ts: "2026-04-23T06:00:10Z",
      type: "llm_result",
      summary: "Final answer produced",
    },
    { seq: 8, ts: "2026-04-23T06:00:11Z", type: "completed", summary: "Run completed" },
  ],
  run_01HSAAAA2: [
    { seq: 1, ts: "2026-04-22T06:00:01Z", type: "started", summary: "Run started" },
    {
      seq: 2,
      ts: "2026-04-22T06:00:02Z",
      type: "tool_call",
      summary: "http.request → GET /orders?day=2026-04-21",
    },
    {
      seq: 3,
      ts: "2026-04-22T06:00:05Z",
      type: "tool_result",
      summary: "502 Bad Gateway after 3 retries",
    },
    {
      seq: 4,
      ts: "2026-04-22T06:00:06Z",
      type: "failed",
      summary: "Run failed — reason=tool_failure",
    },
  ],
  run_01HSAAAA3: [
    { seq: 1, ts: "2026-04-23T10:14:45Z", type: "started", summary: "Run started" },
    {
      seq: 2,
      ts: "2026-04-23T10:14:46Z",
      type: "llm_call",
      summary: "LLM call — classify ticket",
    },
    {
      seq: 3,
      ts: "2026-04-23T10:14:48Z",
      type: "llm_result",
      summary: "Tool decision: memory.read",
    },
    {
      seq: 4,
      ts: "2026-04-23T10:14:49Z",
      type: "tool_call",
      summary: "memory.read → key=policy/refunds",
    },
  ],
};

export const TOOLS = [
  {
    name: "http.request",
    description: "Make an HTTP request with an allow-listed URL pattern.",
  },
  {
    name: "webhook.trigger",
    description: "POST a signed event to a pre-registered webhook.",
  },
  {
    name: "json.transform",
    description: "Apply a JSONPath/jq-style transform to a payload.",
  },
  { name: "memory.read", description: "Read from per-agent JSON memory." },
  { name: "memory.write", description: "Write to per-agent JSON memory." },
];

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").replace(".000Z", "Z");
}

export function statusColor(s: RunStatus): string {
  switch (s) {
    case "completed":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "failed":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "running":
      return "text-sky-400 bg-sky-500/10 border-sky-500/30";
    case "queued":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "cancelled":
      return "text-ink-400 bg-ink-500/10 border-ink-500/30";
  }
}
