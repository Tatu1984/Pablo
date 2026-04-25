import { callLlm, GatewayError } from "@/backend/gateway";
import type { LlmMessage, LlmToolCall, LlmToolDef } from "@/backend/gateway";
import { getAgent, listPromptVersions } from "@/backend/repositories/agent.repository";
import { getProviderEncrypted, touchProvider } from "@/backend/repositories/provider.repository";
import {
  insertRun,
  insertRunEvent,
  updateRun,
} from "@/backend/repositories/run.repository";
import { decryptSecret } from "@/backend/utils/crypto.util";
import { newId } from "@/backend/utils/id.util";
import { getTool, toolsForAgent } from "@/backend/tools/registry";
import { fromLlmToolName, ToolError, toLlmToolName } from "@/backend/tools/types";
import type { Tool, ToolContext } from "@/backend/tools/types";
import { query } from "@/backend/database/client";

const HISTORY_LIMIT = 20;

export class RunnerError extends Error {
  constructor(
    public code:
      | "agent_not_found"
      | "provider_not_found"
      | "steps_exceeded"
      | "runtime_exceeded"
      | "tool_calls_exceeded"
      | "tokens_exceeded"
      | "tool_not_allowed"
      | "tool_failed",
    message: string,
  ) {
    super(message);
  }
}

export type RunnerEvent =
  | { type: "started"; payload: { run_id: string } }
  | { type: "delta"; payload: { content: string } }
  | { type: "tool_call"; payload: { name: string; tool_call_id: string; arguments: unknown } }
  | { type: "tool_result"; payload: { name: string; tool_call_id: string; ok: boolean; summary: string } }
  | { type: "completed"; payload: { run_id: string; usage: LlmUsageSummary; finish_reason: string; content: string } }
  | { type: "failed"; payload: { run_id: string; code: string; detail: string } };

export interface LlmUsageSummary {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface RunnerOptions {
  orgId: string;
  agentId: string;
  userMessage: string;
  onEvent?: (ev: RunnerEvent) => void;
}

export async function createMultiStepRun(opts: RunnerOptions) {
  const { orgId, agentId, userMessage } = opts;

  // ── 1. Load configuration ─────────────────────────────────────────────────
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new RunnerError("agent_not_found", "Agent not found.");

  const provider = await getProviderEncrypted(orgId, agent.provider_id);
  if (!provider) throw new RunnerError("provider_not_found", "Provider not found for this agent.");

  const versions = await listPromptVersions(orgId, agentId);
  const current = versions.find((v) => v.version === agent.current_prompt_version);

  const tools = toolsForAgent(agent.tools);
  const toolDefs: LlmToolDef[] = tools.map((t) => ({
    name: toLlmToolName(t.name),
    description: t.description,
    parameters: t.input_schema,
  }));
  const toolByLlmName = new Map(tools.map((t) => [toLlmToolName(t.name), t]));

  // ── 2. Persist the run ────────────────────────────────────────────────────
  const runId = newId("run");
  await insertRun(runId, orgId, agentId, { message: userMessage });
  opts.onEvent?.({ type: "started", payload: { run_id: runId } });
  let seq = 1;
  const event = async (
    type: Parameters<typeof insertRunEvent>[2],
    summary: string,
    payload: unknown,
  ) => {
    await insertRunEvent(runId, seq++, type, summary, payload);
  };
  await event("started", "Run started", null);

  // ── 3. Build the seed messages (system + history + user) ─────────────────
  const systemPieces = [current?.system_prompt, current?.task_prompt, current?.tool_instructions]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const messages: LlmMessage[] = [];
  if (systemPieces.length) messages.push({ role: "system", content: systemPieces.join("\n\n") });

  const history = await loadHistory(orgId, agentId, runId);
  for (const turn of history) messages.push(turn);
  messages.push({ role: "user", content: userMessage });

  // ── 4. Loop ───────────────────────────────────────────────────────────────
  const limits = agent.limits;
  const start = Date.now();
  const apiKey = provider.encrypted_key ? decryptSecret(provider.encrypted_key) : null;
  const ctx: ToolContext = { orgId, agentId, runId, ephemeral: new Map() };

  let stepCount = 0;
  let toolCallCount = 0;
  let totalIn = 0;
  let totalOut = 0;
  let lastFinish: string = "stop";
  let finalContent = "";

  try {
    while (true) {
      // Wall-clock + token guards before each LLM call.
      const elapsed = Date.now() - start;
      if (elapsed > limits.max_runtime_ms) {
        throw new RunnerError(
          "runtime_exceeded",
          `Run exceeded ${limits.max_runtime_ms}ms wall clock.`,
        );
      }
      if (totalIn + totalOut > limits.max_tokens_per_run) {
        throw new RunnerError(
          "tokens_exceeded",
          `Run exceeded ${limits.max_tokens_per_run} token budget.`,
        );
      }
      if (stepCount >= limits.max_steps) {
        throw new RunnerError(
          "steps_exceeded",
          `Run exceeded ${limits.max_steps} steps without producing a final answer.`,
        );
      }

      stepCount++;
      await event("llm_call", `LLM call #${stepCount} → ${agent.model}`, {
        model: agent.model,
        provider_id: provider.id,
        message_count: messages.length,
        step: stepCount,
      });

      const response = await callLlm({
        provider,
        apiKey,
        model: agent.model,
        messages,
        tools: toolDefs.length ? toolDefs : undefined,
        temperature: 0.2,
        max_tokens: Math.min(4096, limits.max_tokens_per_run),
      });
      totalIn += response.usage.prompt_tokens;
      totalOut += response.usage.completion_tokens;
      lastFinish = response.finish_reason;
      await event("llm_result", `LLM responded (${response.finish_reason})`, {
        usage: response.usage,
        tool_calls: response.tool_calls?.map((c) => ({ id: c.id, name: c.name })) ?? [],
      });

      // No tool calls — that's the final answer.
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalContent = response.content;
        if (finalContent) opts.onEvent?.({ type: "delta", payload: { content: finalContent } });
        break;
      }

      // Push the assistant message so the model can correlate tool results.
      messages.push({
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.tool_calls,
      });

      // Execute each tool call sequentially.
      for (const call of response.tool_calls) {
        if (toolCallCount >= limits.max_tool_calls) {
          throw new RunnerError(
            "tool_calls_exceeded",
            `Run exceeded ${limits.max_tool_calls} tool calls.`,
          );
        }
        toolCallCount++;
        await runToolCall(call, toolByLlmName, ctx, messages, opts, event);
      }
    }

    // ── 5. Persist outcome ────────────────────────────────────────────────
    await event("completed", "Run completed", null);
    await updateRun(runId, {
      status: "completed",
      output: { message: finalContent },
      tokensIn: totalIn,
      tokensOut: totalOut,
      stepCount,
      toolCallCount,
      finished: true,
    });
    await touchProvider(provider.id);

    const usage: LlmUsageSummary = {
      prompt_tokens: totalIn,
      completion_tokens: totalOut,
      total_tokens: totalIn + totalOut,
    };
    opts.onEvent?.({
      type: "completed",
      payload: {
        run_id: runId,
        usage,
        finish_reason: lastFinish,
        content: finalContent,
      },
    });
    return { runId, content: finalContent, usage };
  } catch (err) {
    const code =
      err instanceof RunnerError
        ? err.code
        : err instanceof GatewayError
          ? err.code
          : err instanceof ToolError
            ? `tool_${err.code}`
            : "upstream";
    const detail = err instanceof Error ? err.message : String(err);
    await event("failed", `Run failed: ${code}`, { detail });
    await updateRun(runId, {
      status: "failed",
      reasonCode: code,
      output: { error: detail },
      tokensIn: totalIn,
      tokensOut: totalOut,
      stepCount,
      toolCallCount,
      finished: true,
    });
    opts.onEvent?.({ type: "failed", payload: { run_id: runId, code, detail } });
    throw err;
  }
}

async function runToolCall(
  call: LlmToolCall,
  toolByLlmName: Map<string, Tool>,
  ctx: ToolContext,
  messages: LlmMessage[],
  opts: RunnerOptions,
  event: (
    type: "tool_call" | "tool_result",
    summary: string,
    payload: unknown,
  ) => Promise<void>,
) {
  const registryName = fromLlmToolName(call.name);
  const tool = toolByLlmName.get(call.name) ?? getTool(registryName);

  opts.onEvent?.({
    type: "tool_call",
    payload: {
      name: registryName,
      tool_call_id: call.id,
      arguments: call.arguments,
    },
  });
  await event("tool_call", `${registryName}`, {
    tool_call_id: call.id,
    arguments: call.arguments,
  });

  if (!tool) {
    throw new RunnerError(
      "tool_not_allowed",
      `Model invoked tool "${call.name}" which is not in the agent's allow-list.`,
    );
  }

  let result: unknown;
  let ok = false;
  let summary = "";
  try {
    result = await tool.execute(call.arguments, ctx);
    ok = true;
    summary = summariseToolOutput(result);
  } catch (err) {
    const code = err instanceof ToolError ? err.code : "upstream";
    const detail = err instanceof Error ? err.message : String(err);
    result = { error: { code, detail } };
    summary = `error: ${detail}`;
  }

  opts.onEvent?.({
    type: "tool_result",
    payload: { name: registryName, tool_call_id: call.id, ok, summary },
  });
  await event("tool_result", `${registryName} → ${summary}`, {
    tool_call_id: call.id,
    ok,
    result,
  });

  messages.push({
    role: "tool",
    content: JSON.stringify(result),
    tool_call_id: call.id,
    name: call.name,
  });
}

function summariseToolOutput(value: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.status === "number") return `${obj.status} response`;
    if (typeof obj.ok === "boolean") return obj.ok ? "ok" : "failed";
    if ("found" in obj) return obj.found ? "value found" : "no value";
  }
  return "ok";
}

// Lightweight pull of prior completed turns, the same shape as the one-shot path.
async function loadHistory(
  orgId: string,
  agentId: string,
  excludeRunId: string,
): Promise<LlmMessage[]> {
  const rows = await query<{ id: string; input: { message?: string } | null; output: { message?: string } | null }>(
    `SELECT id, input, output FROM runs
      WHERE org_id = $1 AND agent_id = $2 AND status = 'completed' AND id <> $3
      ORDER BY queued_at DESC
      LIMIT $4`,
    [orgId, agentId, excludeRunId, HISTORY_LIMIT],
  );
  const out: LlmMessage[] = [];
  for (const r of rows.reverse()) {
    if (r.input?.message) out.push({ role: "user", content: r.input.message });
    if (r.output?.message) out.push({ role: "assistant", content: r.output.message });
  }
  return out;
}
