import type { Provider } from "@/shared/types/provider.types";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmMessage {
  role: LlmRole;
  content: string;
  // Set when this is the assistant turn that emitted tool calls.
  tool_calls?: LlmToolCall[];
  // Set on tool-result messages so the model can correlate.
  tool_call_id?: string;
  // Echo of the tool name on tool-result messages.
  name?: string;
}

export interface LlmToolCall {
  id: string;
  // The LLM-side function name (sanitised: "http_request"). The runner maps
  // this back to the registry name ("http.request").
  name: string;
  arguments: unknown;
}

export interface LlmToolDef {
  name: string; // LLM-side name (must match ^[A-Za-z0-9_-]{1,64}$)
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmRequest {
  provider: Provider;
  apiKey: string | null;
  model: string;
  messages: LlmMessage[];
  tools?: LlmToolDef[];
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
  tool_calls?: LlmToolCall[];
  model: string;
  usage: LlmUsage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  raw?: unknown;
}

export interface LlmAdapter {
  call(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
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
      | "network"
      | "tools_unsupported",
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
  }
}
