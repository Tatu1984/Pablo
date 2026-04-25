import { GatewayError } from "@/backend/gateway/types";
import type { LlmAdapter, LlmRequest, LlmResponse } from "@/backend/gateway/types";

// Anthropic's Messages API takes `system` separately from `messages`.
// Streaming is deferred — the gateway wraps .call() into a single chunk.

const ENDPOINT = "https://api.anthropic.com/v1/messages";

function splitSystem(req: LlmRequest) {
  const systemTurns = req.messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = req.messages.filter((m) => m.role !== "system");
  return { system: systemTurns.join("\n\n") || undefined, messages: rest };
}

export const anthropicAdapter: LlmAdapter = {
  async call(req, signal) {
    if (!req.apiKey) throw new GatewayError("missing_key", "Anthropic requires an API key.");

    const { system, messages } = splitSystem(req);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: req.max_tokens ?? 1024,
        temperature: req.temperature,
        stop_sequences: req.stop,
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      const code =
        res.status === 429 ? "rate_limited" : res.status >= 500 ? "upstream" : "bad_request";
      throw new GatewayError(code, `Anthropic ${res.status}: ${text.slice(0, 300)}`, res.status, retryable);
    }

    const data = (await res.json()) as AnthropicResponse;
    const content =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("") ?? "";

    return {
      content,
      model: data.model ?? req.model,
      usage: {
        prompt_tokens: data.usage?.input_tokens ?? 0,
        completion_tokens: data.usage?.output_tokens ?? 0,
        total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      finish_reason: mapStopReason(data.stop_reason),
      raw: data,
    };
  },
};

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

function mapStopReason(r?: string): LlmResponse["finish_reason"] {
  switch (r) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return "stop";
  }
}
