import Link from "next/link";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import {
  getAgentUsageForPeriod,
  getDailyRunCounts,
} from "@/backend/repositories/run.repository";
import { quotaForOrg } from "@/backend/services/quota.service";
import { requireSession } from "@/backend/services/session.service";
import { currentPeriod, planFor } from "@/shared/constants/plans";
import { ensureSubscription } from "@/backend/repositories/subscription.repository";

export default async function UsagePage() {
  const { org } = await requireSession();
  const period = currentPeriod();

  const [quota, sub, byAgent, daily] = await Promise.all([
    quotaForOrg(org.id),
    ensureSubscription(org.id),
    getAgentUsageForPeriod(org.id, period),
    getDailyRunCounts(org.id, 14),
  ]);
  const plan = planFor(sub.plan);

  const totalRuns = byAgent.reduce((a, b) => a + b.runs, 0);
  const totalTokens = byAgent.reduce((a, b) => a + b.tokens, 0);
  const totalCostCents = byAgent.reduce((a, b) => a + b.cost_cents, 0);

  const maxRuns = Math.max(1, ...daily.map((d) => d.runs));

  return (
    <PageFrame>
      <PageHeader
        title="Usage"
        description={`Tokens, runs, and cost for ${period} (UTC). Hard quotas are enforced before a run is enqueued.`}
        actions={
          <Link
            href="/billing"
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
          >
            {plan.label} plan
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Runs (period)" value={totalRuns.toLocaleString()} />
        <Stat label="Tokens (period)" value={totalTokens.toLocaleString()} />
        <Stat label="Cost (period)" value={`$${(totalCostCents / 100).toFixed(2)}`} />
        <Stat
          label="Quota used"
          value={`${pct(quota.tokens_used, quota.tokens_limit)}%`}
        />
      </div>

      <section className="mb-6 rounded-lg border border-ink-800 bg-ink-950 p-5">
        <h3 className="text-sm font-semibold text-ink-100">Runs, last 14 days</h3>
        <div className="mt-4 flex h-40 items-end gap-1">
          {daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-sm bg-accent-600/70"
                  style={{ height: `${(d.runs / maxRuns) * 100}%` }}
                  title={`${d.day}: ${d.runs} runs`}
                />
              </div>
              <span className="text-[9px] text-ink-500">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-100">By agent</h3>
        <div className="overflow-x-auto rounded-lg border border-ink-800">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Runs</th>
                <th className="px-4 py-2.5 font-medium">Tokens</th>
                <th className="px-4 py-2.5 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-950">
              {byAgent.map((u) => (
                <tr key={u.agent_id}>
                  <td className="px-4 py-3">
                    <Link href={`/agents/${u.agent_id}`} className="text-ink-100 hover:text-white">
                      {u.agent_name}
                    </Link>
                    <div className="mono text-[11px] text-ink-500">{u.agent_id}</div>
                  </td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    {u.runs.toLocaleString()}
                  </td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    {u.tokens.toLocaleString()}
                  </td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    ${(u.cost_cents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              {byAgent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-ink-500">
                    No agents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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

function pct(used: number, limit: number): number {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
