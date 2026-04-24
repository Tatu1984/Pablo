import type { ProviderType } from "@/lib/mock";

const LABELS: Record<ProviderType, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  bedrock: "Bedrock",
  openai_compatible: "OpenAI-compatible",
  ollama: "Ollama",
};

const COLORS: Record<ProviderType, string> = {
  openrouter: "border-accent-600/30 bg-accent-600/10 text-accent-600",
  openai: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  anthropic: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  google: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  bedrock: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  openai_compatible: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  ollama: "border-ink-500/30 bg-ink-500/10 text-ink-400",
};

export default function ProviderBadge({ type }: { type: ProviderType }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${COLORS[type]}`}
    >
      {LABELS[type]}
    </span>
  );
}
