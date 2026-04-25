import Link from "next/link";
import StatusBadge from "@/frontend/components/ui/StatusBadge";
import { fmtDate } from "@/frontend/utils/formatters";
import type { OrgRun } from "@/backend/repositories/run.repository";

export default function RunsTable({
  rows,
  showAgent = true,
}: {
  rows: OrgRun[];
  showAgent?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-8 text-center text-xs text-ink-500">
        No runs yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">Run</th>
            {showAgent && <th className="px-4 py-2.5 font-medium">Agent</th>}
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Steps</th>
            <th className="px-4 py-2.5 font-medium">Tokens</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Queued</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800 bg-ink-950">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-ink-900/60">
              <td className="px-4 py-3 align-top">
                <Link
                  href={`/agents/${r.agent_id}/runs/${r.id}`}
                  className="mono text-xs text-ink-100 hover:text-white"
                >
                  {r.id}
                </Link>
                {r.reason_code && (
                  <div className="mt-1 text-[11px] text-ink-500">{r.reason_code}</div>
                )}
              </td>
              {showAgent && (
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/agents/${r.agent_id}`}
                    className="text-ink-100 hover:text-white"
                  >
                    {r.agent_name}
                  </Link>
                  {r.agent_role && (
                    <div className="text-[11px] text-ink-500">{r.agent_role}</div>
                  )}
                </td>
              )}
              <td className="px-4 py-3 align-top">
                <StatusBadge status={r.status} />
              </td>
              <td className="mono px-4 py-3 align-top text-xs text-ink-300">
                {r.step_count}
              </td>
              <td className="mono px-4 py-3 align-top text-xs text-ink-300">
                {(r.tokens_in + r.tokens_out).toLocaleString()}
              </td>
              <td className="mono px-4 py-3 align-top text-xs text-ink-300">
                {duration(r)}
              </td>
              <td className="px-4 py-3 align-top text-xs text-ink-400">
                {fmtDate(r.queued_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function duration(r: OrgRun): string {
  if (r.started_at && r.finished_at) {
    const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
    return `${Math.round(ms / 100) / 10}s`;
  }
  if (r.status === "running" || r.status === "queued") return "live";
  return "—";
}
