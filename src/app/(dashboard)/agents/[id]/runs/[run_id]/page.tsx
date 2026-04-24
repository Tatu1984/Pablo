import Link from "next/link";
import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import StatusBadge from "@/frontend/components/ui/StatusBadge";
import { fmtDate } from "@/frontend/utils/formatters";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getRun, getTrace } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function RunDetailPage({
  params,
}: {
  params: { id: string; run_id: string };
}) {
  const { org } = await requireSession();
  const [agent, run] = await Promise.all([
    getAgent(org.id, params.id),
    getRun(org.id, params.run_id),
  ]);
  if (!agent || !run) notFound();

  const steps = await getTrace(org.id, run.id);

  return (
    <PageFrame>
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${agent.id}`, label: agent.name },
          { label: "Runs" },
          { label: run.id },
        ]}
        title={<span className="mono">{run.id}</span>}
        description="Append-only step-by-step record. What was sent, what came back, and when."
        actions={
          <>
            <StatusBadge status={run.status} />
            {run.status === "running" && (
              <button className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20">
                Kill switch
              </button>
            )}
            <button className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900">
              Replay
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Stat label="Steps" value={`${run.step_count}/${agent.limits.max_steps}`} />
        <Stat label="Tool calls" value={`${run.tool_call_count}/${agent.limits.max_tool_calls}`} />
        <Stat label="Tokens in" value={run.tokens_in.toLocaleString()} />
        <Stat label="Tokens out" value={run.tokens_out.toLocaleString()} />
        <Stat
          label="Duration"
          value={
            run.started_at && run.finished_at
              ? `${Math.round(
                  (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000,
                )}s`
              : run.status === "running"
                ? "live"
                : "—"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-100">Trace</h2>
          <ol className="relative flex flex-col gap-0 rounded-lg border border-ink-800 bg-ink-950">
            {steps.map((s) => (
              <li
                key={s.seq}
                className="grid grid-cols-[4rem_6.5rem_1fr] items-start gap-3 border-b border-ink-800 px-4 py-3 text-xs last:border-b-0"
              >
                <span className="mono text-ink-500">#{String(s.seq).padStart(3, "0")}</span>
                <span className="mono">
                  <TypeBadge type={s.type} />
                </span>
                <div>
                  <div className="text-ink-100">{s.summary}</div>
                  <div className="mt-0.5 text-[11px] text-ink-500">{fmtDate(s.ts)}</div>
                  {s.detail ? (
                    <pre className="mono mt-2 overflow-x-auto rounded bg-ink-900 p-2 text-[11px] text-ink-300">
                      {JSON.stringify(s.detail, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
            {steps.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-ink-500">No trace events yet.</li>
            )}
          </ol>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h3 className="text-sm font-semibold text-ink-100">Run</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <KV label="Agent" value={agent.name} />
              <KV label="Prompt" value={agent.current_prompt_version} />
              <KV label="Queued" value={fmtDate(run.queued_at)} />
              <KV label="Started" value={fmtDate(run.started_at)} />
              <KV label="Finished" value={fmtDate(run.finished_at)} />
              <KV label="Reason" value={run.reason_code ?? "—"} />
            </dl>
          </section>

          <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h3 className="text-sm font-semibold text-ink-100">Logs</h3>
            <pre className="mono mt-3 max-h-64 overflow-auto rounded bg-ink-900 p-2 text-[11px] text-ink-300">
{`[${run.queued_at}] queued
[${run.started_at ?? run.queued_at}] started worker=wkr-iad-03
[${run.started_at ?? run.queued_at}] llm_call model=${agent.model}
[${run.finished_at ?? "…"}] terminal status=${run.status}`}
            </pre>
            <Link href="#" className="mt-2 inline-block text-[11px] text-ink-400 hover:text-ink-200">
              Download full trace
            </Link>
          </section>
        </aside>
      </div>
    </PageFrame>
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="mono text-right text-ink-200">{value}</dd>
    </>
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
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {type}
    </span>
  );
}
