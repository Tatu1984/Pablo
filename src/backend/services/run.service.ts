import { streamLlm, GatewayError } from "@/backend/gateway";
import type { LlmMessage } from "@/backend/gateway";
import { getAgent, listPromptVersions } from "@/backend/repositories/agent.repository";
import { getProviderEncrypted, touchProvider } from "@/backend/repositories/provider.repository";
import {
  getRunsForAgent,
  insertRun,
  insertRunEvent,
  updateRun,
} from "@/backend/repositories/run.repository";
import { decryptSecret } from "@/backend/utils/crypto.util";
import { newId } from "@/backend/utils/id.util";
import { truncatePayload } from "@/backend/utils/payload.util";
import { assertCanRun, QuotaError, recordRunUsage } from "@/backend/services/quota.service";
import { dispatchEvent } from "@/backend/services/webhook.service";
import { createMultiStepRun } from "@/backend/services/runner.service";
import type { RunnerEvent } from "@/backend/services/runner.service";

const HISTORY_LIMIT = 20;

export class RunError extends Error {
  constructor(
    public code:
      | "agent_not_found"
      | "provider_not_found"
      | "prompt_missing",
    message: string,
  ) {
    super(message);
  }
}

// Dispatch entry point — picks streaming one-shot when the agent has no
// tools (preserving Phase 3's token-by-token UX) and the multi-step runner
// otherwise.
export async function createRun(opts: OneShotOptions) {
  const agent = await getAgent(opts.orgId, opts.agentId);
  if (!agent) throw new RunError("agent_not_found", "Agent not found.");

  if (agent.tools.length === 0) {
    return createOneShotRun(opts);
  }
  return createMultiStepRun({
    orgId: opts.orgId,
    agentId: opts.agentId,
    userMessage: opts.userMessage,
    onEvent: (ev: RunnerEvent) => {
      // Bridge runner events back through the SSE-shaped onEvent + onDelta hooks.
      if (ev.type === "delta") opts.onDelta?.(ev.payload.content);
      opts.onEvent?.(ev);
    },
  });
}

export interface OneShotOptions {
  orgId: string;
  agentId: string;
  userMessage: string;
  onDelta?: (chunk: string) => void;
  // Same shape as RunnerEvent; one-shot path only emits started/completed/failed
  // but the dispatcher passes the full union through to the SSE writer.
  onEvent?: (ev: RunnerEvent) => void;
}

export async function createOneShotRun(opts: OneShotOptions) {
  const { orgId, agentId, userMessage } = opts;

  // ── 1. Load the full config we need to drive the LLM ──────────────────────
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new RunError("agent_not_found", "Agent not found.");

  const provider = await getProviderEncrypted(orgId, agent.provider_id);
  if (!provider) throw new RunError("provider_not_found", "Provider not found for this agent.");

  const versions = await listPromptVersions(orgId, agentId);
  const current = versions.find((v) => v.version === agent.current_prompt_version);

  // ── 2. Quota guard — refuse to even insert the run if the org is over the
  //    monthly plan ceiling (developer guide §3.1).
  await assertCanRun(orgId);

  // ── 3. Persist the run row so the rest of the work is traceable ───────────
  const runId = newId("run");
  await insertRun(runId, orgId, agentId, { message: userMessage });
  opts.onEvent?.({ type: "started", payload: { run_id: runId } });
  await insertRunEvent(runId, 1, "started", "Run started", null);

  try {
    // ── 3. Assemble the message list ────────────────────────────────────────
    const systemPieces = [current?.system_prompt, current?.task_prompt, current?.tool_instructions]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    const messages: LlmMessage[] = [];
    if (systemPieces.length) messages.push({ role: "system", content: systemPieces.join("\n\n") });

    // Prior conversation — pairs of {user input, assistant output} from completed runs.
    const history = await getRunsForAgent(orgId, agentId);
    const priorPairs = history
      .filter((r) => r.id !== runId && r.status === "completed")
      .slice(0, HISTORY_LIMIT)
      .reverse();

    for (const r of priorPairs) {
      const [userMsg, asstMsg] = await loadRunPair(r.id);
      if (userMsg) messages.push({ role: "user", content: userMsg });
      if (asstMsg) messages.push({ role: "assistant", content: asstMsg });
    }
    messages.push({ role: "user", content: userMessage });

    await insertRunEvent(runId, 2, "llm_call", `LLM call → ${agent.model}`, {
      model: agent.model,
      provider_id: provider.id,
      step: 1,
      message_count: messages.length,
      messages: truncatePayload(messages),
    });
    // No "thinking" event — the UI shows a placeholder until first delta.

    const apiKey = provider.encrypted_key ? decryptSecret(provider.encrypted_key) : null;

    // ── 4. Stream (or call) the LLM ─────────────────────────────────────────
    let assembled = "";
    const onDelta = (chunk: string) => {
      assembled += chunk;
      opts.onDelta?.(chunk);
    };

    const response = await streamLlm(
      {
        provider,
        apiKey,
        model: agent.model,
        messages,
        temperature: 0.2,
        max_tokens: agent.limits.max_tokens_per_run > 4096 ? 4096 : agent.limits.max_tokens_per_run,
      },
      onDelta,
    );

    // ── 5. Persist outcome ──────────────────────────────────────────────────
    await insertRunEvent(runId, 3, "llm_result", `Finished (${response.finish_reason})`, {
      usage: response.usage,
      finish_reason: response.finish_reason,
      content: truncatePayload(response.content),
    });
    await insertRunEvent(runId, 4, "completed", "Run completed", null);
    await updateRun(runId, {
      status: "completed",
      output: { message: response.content },
      tokensIn: response.usage.prompt_tokens,
      tokensOut: response.usage.completion_tokens,
      stepCount: 1,
      toolCallCount: 0,
      finished: true,
    });
    await touchProvider(provider.id);
    await recordRunUsage(orgId, response.usage.prompt_tokens, response.usage.completion_tokens);
    void dispatchEvent(orgId, "execution.completed", {
      run_id: runId,
      agent_id: agentId,
      status: "completed",
      finish_reason: response.finish_reason,
      tokens_in: response.usage.prompt_tokens,
      tokens_out: response.usage.completion_tokens,
      output: { message: assembled || response.content },
    }).catch((e) => console.error("webhook dispatch failed:", e));

    opts.onEvent?.({
      type: "completed",
      payload: {
        run_id: runId,
        usage: response.usage,
        finish_reason: response.finish_reason,
        content: assembled || response.content,
      },
    });

    return { runId, content: assembled || response.content, usage: response.usage };
  } catch (err) {
    const code =
      err instanceof GatewayError ? err.code : err instanceof RunError ? err.code : "upstream";
    const detail = err instanceof Error ? err.message : String(err);
    await insertRunEvent(runId, 99, "failed", `Run failed: ${code}`, { detail });
    await updateRun(runId, {
      status: "failed",
      reasonCode: code,
      output: { error: detail },
      finished: true,
    });
    opts.onEvent?.({ type: "failed", payload: { run_id: runId, code, detail } });
    void dispatchEvent(orgId, "execution.failed", {
      run_id: runId,
      agent_id: agentId,
      code,
      detail,
    }).catch((e) => console.error("webhook dispatch failed:", e));
    throw err;
  }
}

async function loadRunPair(runId: string): Promise<[string | null, string | null]> {
  // Lightweight fetch of input.message + output.message for building history.
  const { query } = await import("@/backend/database/client");
  const rows = await query<{ input: unknown; output: unknown }>(
    `SELECT input, output FROM runs WHERE id = $1`,
    [runId],
  );
  const row = rows[0];
  if (!row) return [null, null];
  return [extractMessage(row.input), extractMessage(row.output)];
}

function extractMessage(v: unknown): string | null {
  if (v && typeof v === "object" && "message" in v) {
    const m = (v as { message: unknown }).message;
    return typeof m === "string" ? m : null;
  }
  return null;
}
