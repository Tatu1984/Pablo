import { GatewayError } from "@/backend/gateway/types";
import type {
  LlmAdapter,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmToolCall,
} from "@/backend/gateway/types";

// Anthropic Messages API. System prompts go in a top-level `system` field.
// Conversation messages use a content-array model: text + tool_use blocks
// for assistant turns, text + tool_result blocks for user turns. Tools are
// declared at the top level of the request as {name, description,
// input_schema}.

const ENDPOINT = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

function splitSystem(messages: LlmMessage[]) {
  const sysParts: string[] = [];
  const turns: LlmMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      if (m.content) sysParts.push(m.content);
    } else {
      turns.push(m);
    }
  }
  return { system: sysParts.join("\n\n") || undefined, turns };
}

function encodeMessages(turns: LlmMessage[]): AnthropicMessage[] {
  // The runner emits assistant turns with optional `tool_calls` and tool-
  // result turns as `role: "tool"`. Convert both into Anthropic's content
  // arrays. Adjacent tool-result messages are merged into a single user
  // turn because Anthropic requires alternating user/assistant.
  const out: AnthropicMessage[] = [];

  for (const m of turns) {
    if (m.role === "tool") {
      const block: AnthropicContentBlock = {
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "",
        content: m.content ?? "",
      };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }

    if (m.role === "assistant") {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input:
              typeof tc.arguments === "string"
                ? safeJsonObject(tc.arguments)
                : ((tc.arguments as Record<string, unknown>) ?? {}),
          });
        }
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : (m.content ?? "") });
      continue;
    }

    // role === "user"
    out.push({ role: "user", content: m.content ?? "" });
  }

  return out;
}

function safeJsonObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const anthropicAdapter: LlmAdapter = {
  async call(req, signal) {
    if (!req.apiKey) throw new GatewayError("missing_key", "Anthropic requires an API key.");

    const { system, turns } = splitSystem(req.messages);
    const payload: Record<string, unknown> = {
      model: req.model,
      messages: encodeMessages(turns),
      max_tokens: req.max_tokens ?? 1024,
    };
    if (system) payload.system = system;
    if (req.temperature !== undefined) payload.temperature = req.temperature;
    if (req.stop && req.stop.length) payload.stop_sequences = req.stop;
    if (req.tools && req.tools.length) {
      payload.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      const code =
        res.status === 429 ? "rate_limited" : res.status >= 500 ? "upstream" : "bad_request";
      throw new GatewayError(
        code,
        `Anthropic ${res.status}: ${text.slice(0, 300)}`,
        res.status,
        retryable,
      );
    }

    const data = (await res.json()) as AnthropicResponse;

    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];
    for (const block of data.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block.type === "tool_use" && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    return {
      content: textParts.join(""),
      tool_calls: toolCalls.length ? toolCalls : undefined,
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
  content?: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }[];
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
    case "stop_sequence":
      return "stop";
    default:
      return "stop";
  }
}
