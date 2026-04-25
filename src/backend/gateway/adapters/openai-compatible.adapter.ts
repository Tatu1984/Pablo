import { GatewayError } from "@/backend/gateway/types";
import type {
  LlmAdapter,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmToolCall,
  LlmUsage,
} from "@/backend/gateway/types";

// Works with anything speaking OpenAI's chat-completions shape:
// OpenRouter, OpenAI, OpenAI-compatible (Together/Groq/Fireworks/vLLM), Ollama.

function endpoint(req: LlmRequest): string {
  const base = (req.provider.base_url ?? "").replace(/\/$/, "");
  if (!base) throw new GatewayError("bad_request", "Provider has no base_url configured.");
  return `${base}/chat/completions`;
}

function headers(req: LlmRequest): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (req.apiKey) h.Authorization = `Bearer ${req.apiKey}`;
  if (req.provider.type === "openrouter") {
    const site = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    h["HTTP-Referer"] = site;
    h["X-Title"] = "Pablo";
  }
  return h;
}

interface OutgoingMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

function encodeMessages(messages: LlmMessage[]): OutgoingMessage[] {
  return messages.map((m) => {
    const out: OutgoingMessage = { role: m.role, content: m.content ?? "" };
    if (m.tool_calls?.length) {
      out.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments:
            typeof tc.arguments === "string"
              ? tc.arguments
              : JSON.stringify(tc.arguments ?? {}),
        },
      }));
    }
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
}

function body(req: LlmRequest, stream: boolean) {
  const payload: Record<string, unknown> = {
    model: req.model,
    messages: encodeMessages(req.messages),
    stream,
  };
  if (req.temperature !== undefined) payload.temperature = req.temperature;
  if (req.max_tokens !== undefined) payload.max_tokens = req.max_tokens;
  if (req.stop && req.stop.length) payload.stop = req.stop;
  if (req.tools && req.tools.length) {
    payload.tools = req.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    payload.tool_choice = "auto";
  }
  if (stream) payload.stream_options = { include_usage: true };
  return JSON.stringify(payload);
}

function mapError(status: number, text: string): GatewayError {
  const retryable = status === 429 || status >= 500;
  const code = status === 429 ? "rate_limited" : status >= 500 ? "upstream" : "bad_request";
  return new GatewayError(code, `Upstream ${status}: ${text.slice(0, 300)}`, status, retryable);
}

export const openaiCompatibleAdapter: LlmAdapter = {
  async call(req, signal) {
    const res = await fetch(endpoint(req), {
      method: "POST",
      headers: headers(req),
      body: body(req, false),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw mapError(res.status, text);
    }
    const data = (await res.json()) as OpenAIChatResponse;
    return normaliseFull(data);
  },

  async stream(req, onDelta, signal) {
    const res = await fetch(endpoint(req), {
      method: "POST",
      headers: headers(req),
      body: body(req, true),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text().catch(() => "") : "no body";
      throw mapError(res.status, text);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let model = req.model;
    let usage: LlmUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let finish: LlmResponse["finish_reason"] = "stop";

    // Streaming tool_calls arrive as accumulating deltas keyed by their index.
    const toolDelta = new Map<
      number,
      { id?: string; name?: string; argumentsBuf: string }
    >();

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, sep).trim();
          buffer = buffer.slice(sep + 1);
          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          let evt: OpenAIChatStreamChunk;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }

          if (evt.model) model = evt.model;
          if (evt.usage) usage = normaliseUsage(evt.usage);

          const choice = evt.choices?.[0];
          if (choice?.delta?.content) {
            const piece = choice.delta.content;
            content += piece;
            onDelta(piece);
          }
          if (choice?.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const idx = tc.index ?? 0;
              const slot = toolDelta.get(idx) ?? { argumentsBuf: "" };
              if (tc.id) slot.id = tc.id;
              if (tc.function?.name) slot.name = tc.function.name;
              if (tc.function?.arguments) slot.argumentsBuf += tc.function.arguments;
              toolDelta.set(idx, slot);
            }
          }
          if (choice?.finish_reason) finish = normaliseFinish(choice.finish_reason);
        }
      }
    } finally {
      reader.releaseLock();
    }

    const tool_calls: LlmToolCall[] = [];
    for (const [, slot] of [...toolDelta.entries()].sort((a, b) => a[0] - b[0])) {
      if (!slot.id || !slot.name) continue;
      tool_calls.push({
        id: slot.id,
        name: slot.name,
        arguments: tryParseJson(slot.argumentsBuf),
      });
    }

    return {
      content,
      model,
      usage,
      finish_reason: finish,
      tool_calls: tool_calls.length ? tool_calls : undefined,
    };
  },
};

// ─── normalisers ─────────────────────────────────────────────────────────────

interface OpenAIChatResponse {
  model?: string;
  choices: {
    message: {
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason?: string;
  }[];
  usage?: OpenAIUsage;
}

interface OpenAIChatStreamChunk {
  model?: string;
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string;
  }[];
  usage?: OpenAIUsage;
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function normaliseFull(data: OpenAIChatResponse): LlmResponse {
  const choice = data.choices[0];
  const content = choice?.message?.content ?? "";
  const tool_calls: LlmToolCall[] | undefined = choice?.message?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tryParseJson(tc.function.arguments),
  }));
  return {
    content,
    tool_calls: tool_calls?.length ? tool_calls : undefined,
    model: data.model ?? "",
    usage: normaliseUsage(data.usage),
    finish_reason: normaliseFinish(choice?.finish_reason),
    raw: data,
  };
}

function normaliseUsage(u?: OpenAIUsage): LlmUsage {
  return {
    prompt_tokens: u?.prompt_tokens ?? 0,
    completion_tokens: u?.completion_tokens ?? 0,
    total_tokens:
      u?.total_tokens ?? (u?.prompt_tokens ?? 0) + (u?.completion_tokens ?? 0),
  };
}

function normaliseFinish(r?: string): LlmResponse["finish_reason"] {
  switch (r) {
    case "length":
    case "tool_calls":
    case "content_filter":
    case "stop":
      return r;
    default:
      return "stop";
  }
}

function tryParseJson(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
