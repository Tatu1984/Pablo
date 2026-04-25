import type { Provider } from "@/shared/types/provider.types";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmRequest {
  provider: Provider;
  apiKey: string | null; // null allowed for ollama / bedrock-iam
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

export interface LlmUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: LlmUsage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  raw?: unknown;
}

export interface LlmAdapter {
  // Non-streaming call — returns the full response. All adapters implement this.
  call(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;

  // Streaming call. Emits text chunks and resolves with the complete response.
  // Optional — adapters without streaming support can lean on .call() and
  // emit the whole result as a single chunk.
  stream?(
    req: LlmRequest,
    onDelta: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmResponse>;
}

export class GatewayError extends Error {
  constructor(
    public code:
      | "provider_unsupported"
      | "missing_key"
      | "rate_limited"
      | "bad_request"
      | "upstream"
      | "timeout"
      | "network",
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
  }
}
