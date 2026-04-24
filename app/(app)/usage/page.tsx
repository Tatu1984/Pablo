import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { getAgents } from "@/lib/queries";

const FAKE_VOLUMES = [
  { runs: 128, tokens: 312_400, cost_cents: 0 },
  { runs: 942, tokens: 1_812_300, cost_cents: 0 },
  { runs: 14, tokens: 88_210, cost_cents: 0 },
];

const DAYS = Array.from({ length: 14 }, (_, i) => ({
  day: `2026-04-${String(10 + i).padStart(2, "0")}`,
  runs: Math.round(40 + Math.sin(i / 2) * 25 + Math.random() * 18),
}));
const maxRuns = Math.max(...DAYS.map((d) => d.runs));

export default async function UsagePage() {
  const agents = await getAgents();
  const USAGE_BY_AGENT = agents.map((a, i) => ({
    agent_id: a.id,
    agent_name: a.name,
    ...(FAKE_VOLUMES[i] ?? { runs: 0, tokens: 0, cost_cents: 0 }),
  }));
  const totalRuns = USAGE_BY_AGENT.reduce((a, b) => a + b.runs, 0);
  const totalTokens = USAGE_BY_AGENT.reduce((a, b) => a + b.tokens, 0);

  return (
    <PageFrame>
      <PageHeader
        title="Usage"
        description="Tokens, runs, and cost rolled up across your org. Hard quotas are enforced before a run is enqueued."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Runs (30d)" value={totalRuns.toLocaleString()} />
        <Stat label="Tokens (30d)" value={totalTokens.toLocaleString()} />
        <Stat label="Cost (30d)" value="$0.00" />
        <Stat label="Quota used" value="24%" />
      </div>

      <section className="mb-6 rounded-lg border border-ink-800 bg-ink-950 p-5">
        <h3 className="text-sm font-semibold text-ink-100">Runs, last 14 days</h3>
        <div className="mt-4 flex h-40 items-end gap-1">
          {DAYS.map((d) => (
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
              {USAGE_BY_AGENT.map((u) => (
                <tr key={u.agent_id}>
                  <td className="px-4 py-3">
                    <div className="text-ink-100">{u.agent_name}</div>
                    <div className="mono text-[11px] text-ink-500">{u.agent_id}</div>
                  </td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">{u.runs.toLocaleString()}</td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    {u.tokens.toLocaleString()}
                  </td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    ${(u.cost_cents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
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
