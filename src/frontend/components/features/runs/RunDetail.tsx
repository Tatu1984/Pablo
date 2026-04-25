"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/frontend/components/ui/StatusBadge";
import JsonView from "@/frontend/components/ui/JsonView";
import { fmtDate } from "@/frontend/utils/formatters";
import type { Run, TraceStep } from "@/shared/types/run.types";
import type { Agent } from "@/shared/types/agent.types";

const POLL_INTERVAL_MS = 2_000;

export default function RunDetail({
  agent,
  initialRun,
  initialTrace,
}: {
  agent: Agent;
  initialRun: Run;
  initialTrace: TraceStep[];
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run>(initialRun);
  const [trace, setTrace] = useState<TraceStep[]>(initialTrace);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  // Poll for new events while the run is still going.
  useEffect(() => {
    if (run.status !== "queued" && run.status !== "running") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stoppedRef.current) return;
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
        if (res.ok) {
          const { run: nextRun, trace: nextTrace } = (await res.json()) as {
            run: Run;
            trace: TraceStep[];
          };
          setRun(nextRun);
          setTrace(nextTrace);
          if (nextRun.status === "completed" || nextRun.status === "failed" || nextRun.status === "cancelled") {
            return; // stop polling
          }
        }
      } catch {
        /* keep polling */
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [run.id, run.status]);

  async function onCancel() {
    if (!confirm("Cancel this run? In-flight LLM calls will finish but no further steps will run.")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/cancel`, { method: "POST" });
      if (res.ok) {
        const { run: nextRun } = (await res.json()) as { run: Run };
        setRun(nextRun);
      } else {
        const p = await res.json().catch(() => ({}));
        setCancelError(p?.detail ?? "Could not cancel run.");
      }
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setCancelling(false);
      router.refresh();
    }
  }

  const live = run.status === "queued" || run.status === "running";
  const duration =
    run.started_at && run.finished_at
      ? `${Math.round(
          (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000,
        )}s`
      : live
        ? "live"
        : "—";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={run.status} />
        {live && (
          <span className="mono inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            polling
          </span>
        )}
        {run.reason_code && (
          <span className="mono rounded border border-ink-800 bg-ink-900 px-2 py-0.5 text-[11px] text-ink-300">
            reason: {run.reason_code}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {live && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60"
            >
              {cancelling ? "Cancelling…" : "Kill run"}
            </button>
          )}
          <Link
            href={`/agents/${agent.id}`}
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
          >
            Back to chat
          </Link>
        </div>
      </div>

      {cancelError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {cancelError}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Stat label="Steps" value={`${run.step_count}/${agent.limits.max_steps}`} />
        <Stat
          label="Tool calls"
          value={`${run.tool_call_count}/${agent.limits.max_tool_calls}`}
        />
        <Stat label="Tokens in" value={run.tokens_in.toLocaleString()} />
        <Stat label="Tokens out" value={run.tokens_out.toLocaleString()} />
        <Stat label="Duration" value={duration} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-100">Trace</h2>
          <ol className="flex flex-col gap-2">
            {trace.map((s) => (
              <TraceCard key={s.seq} step={s} />
            ))}
            {trace.length === 0 && (
              <li className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-6 text-center text-xs text-ink-500">
                No trace events yet.
              </li>
            )}
          </ol>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h3 className="text-sm font-semibold text-ink-100">Run</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <KV label="Run ID" value={run.id} mono />
              <KV label="Agent" value={agent.name} />
              <KV label="Prompt" value={agent.current_prompt_version} />
              <KV label="Queued" value={fmtDate(run.queued_at)} />
              <KV label="Started" value={fmtDate(run.started_at)} />
              <KV label="Finished" value={fmtDate(run.finished_at)} />
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mono mt-1 text-lg text-ink-50">{value}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className={`${mono ? "mono" : ""} text-right text-ink-200`}>{value}</dd>
    </>
  );
}

function TraceCard({ step }: { step: TraceStep }) {
  const detail = step.detail as Record<string, unknown> | undefined;

  return (
    <li className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-3 text-xs">
      <header className="flex items-start gap-3">
        <span className="mono text-ink-500">#{String(step.seq).padStart(3, "0")}</span>
        <TypeBadge type={step.type} />
        <div className="min-w-0 flex-1">
          <div className="text-ink-100">{step.summary}</div>
          <div className="mt-0.5 text-[10px] text-ink-500">{fmtDate(step.ts)}</div>
        </div>
      </header>

      {detail && Object.keys(detail).length > 0 && (
        <div className="mt-3">
          {step.type === "llm_call" ? (
            <LlmCallDetail detail={detail} />
          ) : step.type === "llm_result" ? (
            <LlmResultDetail detail={detail} />
          ) : step.type === "tool_call" ? (
            <ToolCallDetail detail={detail} />
          ) : step.type === "tool_result" ? (
            <ToolResultDetail detail={detail} />
          ) : (
            <JsonView value={detail} label="payload" collapsed />
          )}
        </div>
      )}
    </li>
  );
}

function LlmCallDetail({ detail }: { detail: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-400">
        {detail.model ? (
          <>
            <span>Model</span>
            <span className="mono text-right text-ink-200">{String(detail.model)}</span>
          </>
        ) : null}
        {detail.message_count !== undefined ? (
          <>
            <span>Messages</span>
            <span className="mono text-right text-ink-200">{String(detail.message_count)}</span>
          </>
        ) : null}
        {Array.isArray(detail.tools) && detail.tools.length > 0 ? (
          <>
            <span>Tools</span>
            <span className="mono text-right text-ink-200">
              {(detail.tools as string[]).join(", ")}
            </span>
          </>
        ) : null}
      </div>
      {Array.isArray(detail.messages) && (
        <JsonView value={detail.messages} label="messages →" collapsed />
      )}
    </div>
  );
}

function LlmResultDetail({ detail }: { detail: Record<string, unknown> }) {
  const usage = detail.usage as
    | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    | undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-400">
        {usage ? (
          <>
            <span>Tokens (in / out)</span>
            <span className="mono text-right text-ink-200">
              {usage.prompt_tokens} / {usage.completion_tokens}
            </span>
          </>
        ) : null}
        {detail.finish_reason ? (
          <>
            <span>Finish</span>
            <span className="mono text-right text-ink-200">{String(detail.finish_reason)}</span>
          </>
        ) : null}
      </div>
      {typeof detail.content === "string" && detail.content.length > 0 && (
        <pre className="mono max-h-48 overflow-auto rounded border border-ink-800 bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-ink-200">
          {detail.content}
        </pre>
      )}
      {Array.isArray(detail.tool_calls) && detail.tool_calls.length > 0 && (
        <JsonView value={detail.tool_calls} label="tool calls" collapsed />
      )}
    </div>
  );
}

function ToolCallDetail({ detail }: { detail: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-ink-400">Arguments:</div>
      <JsonView value={detail.arguments ?? {}} label="input" collapsed={false} />
    </div>
  );
}

function ToolResultDetail({ detail }: { detail: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-400">
        <span>Status</span>
        <span className="mono text-right text-ink-200">{detail.ok ? "ok" : "failed"}</span>
      </div>
      <JsonView value={detail.result ?? null} label="output" collapsed={false} />
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    started: "border-ink-500/30 bg-ink-500/10 text-ink-300",
    llm_call: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    llm_result: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    tool_call: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    tool_result: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    failed: "border-red-500/30 bg-red-500/10 text-red-300",
    cancelled: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
  const cls = map[type] ?? "border-ink-500/30 bg-ink-500/10 text-ink-300";
  return (
    <span className={`mono inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {type}
    </span>
  );
}
