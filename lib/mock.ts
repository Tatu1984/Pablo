// Static constants + display helpers.
// Domain data (agents, providers, runs, trace) now lives in Postgres — see
// lib/db.ts and lib/queries.ts. Types live in lib/types.ts.

export type {
  Agent,
  AgentLimits,
  ExecutionMode,
  Provider,
  ProviderType,
  Run,
  RunStatus,
  Skill,
  TraceStep,
} from "./types";
import type { RunStatus, ProviderType } from "./types";

export const TOOLS = [
  { name: "http.request", description: "Make an HTTP request with an allow-listed URL pattern." },
  { name: "webhook.trigger", description: "POST a signed event to a pre-registered webhook." },
  { name: "json.transform", description: "Apply a JSONPath/jq-style transform to a payload." },
  { name: "memory.read", description: "Read from per-agent JSON memory." },
  { name: "memory.write", description: "Write to per-agent JSON memory." },
];

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
      { name: "base_url", label: "Base URL", placeholder: "https://api.together.xyz/v1" },
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
