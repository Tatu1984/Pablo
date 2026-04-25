import { openaiCompatibleAdapter } from "./adapters/openai-compatible.adapter";
import { anthropicAdapter } from "./adapters/anthropic.adapter";
import { GatewayError } from "./types";
import type { LlmAdapter, LlmRequest, LlmResponse } from "./types";
import type { Provider } from "@/shared/types/provider.types";

export type {
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmToolCall,
  LlmToolDef,
  LlmUsage,
} from "./types";
export { GatewayError } from "./types";

function pickAdapter(provider: Provider): LlmAdapter {
  switch (provider.type) {
    case "openrouter":
    case "openai":
    case "openai_compatible":
    case "ollama":
      return openaiCompatibleAdapter;
    case "anthropic":
      return anthropicAdapter;
    case "google":
    case "bedrock":
    default:
      throw new GatewayError(
        "provider_unsupported",
        `Provider type "${provider.type}" is not wired into the gateway yet.`,
      );
  }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [250, 500, 1000];
const REQUEST_TIMEOUT_MS = 60_000;

async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  let last: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fn(ctrl.signal);
    } catch (err) {
      last = err;
      const retryable =
        err instanceof GatewayError
          ? err.retryable
          : err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("fetch failed"));
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw err;
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const adapter = pickAdapter(req.provider);
  return withRetry((signal) => adapter.call(req, signal));
}

export async function streamLlm(
  req: LlmRequest,
  onDelta: (chunk: string) => void,
): Promise<LlmResponse> {
  const adapter = pickAdapter(req.provider);
  if (adapter.stream) {
    return withRetry((signal) => adapter.stream!(req, onDelta, signal));
  }
  // Adapter doesn't stream natively — fall back to one big chunk at the end.
  const full = await withRetry((signal) => adapter.call(req, signal));
  if (full.content) onDelta(full.content);
  return full;
}
