import type { ProviderType } from "@/shared/types/provider.types";

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
