import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";

const INVOICES = [
  { id: "in_0421", period: "2026-04", amount_cents: 0, status: "paid", hosted_url: "#" },
  { id: "in_0321", period: "2026-03", amount_cents: 0, status: "paid", hosted_url: "#" },
  { id: "in_0221", period: "2026-02", amount_cents: 0, status: "paid", hosted_url: "#" },
];

export default function BillingPage() {
  return (
    <PageFrame>
      <PageHeader
        title="Billing"
        description="Managed through Stripe. Plan changes and payment methods open in the Stripe billing portal."
        actions={
          <button className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700">
            Open Stripe portal
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-100">Plan</h2>
              <p className="mt-1 text-xs text-ink-500">Your current subscription.</p>
            </div>
            <span className="rounded border border-accent-600/40 bg-accent-600/10 px-2 py-0.5 text-[11px] font-medium text-accent-500">
              Starter
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <KV label="Tokens / month" value="2,000,000" />
            <KV label="Runs / month" value="10,000" />
            <KV label="Max concurrent runs" value="4" />
            <KV label="Current period ends" value="2026-05-01" />
          </dl>

          <div className="mt-5 flex items-center gap-2">
            <button className="rounded-md border border-ink-800 bg-ink-900 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800">
              Upgrade
            </button>
            <button className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-900">
              Downgrade
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
          <h2 className="text-sm font-semibold text-ink-100">This period</h2>
          <dl className="mt-4 flex flex-col gap-3 text-xs">
            <Meter label="Tokens" used={483_910} limit={2_000_000} />
            <Meter label="Runs" used={1_084} limit={10_000} />
            <Meter label="Cost" used={0} limit={5000} unit="$" divisor={100} />
          </dl>
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-100">Invoices</h3>
        <div className="overflow-x-auto rounded-lg border border-ink-800">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-950">
              {INVOICES.map((i) => (
                <tr key={i.id}>
                  <td className="mono px-4 py-3 text-xs text-ink-100">{i.id}</td>
                  <td className="px-4 py-3 text-xs text-ink-300">{i.period}</td>
                  <td className="mono px-4 py-3 text-xs text-ink-300">
                    ${(i.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400">
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <a href={i.hosted_url} className="text-ink-400 hover:text-ink-200">
                      View
                    </a>
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="mono text-right text-ink-200">{value}</dd>
    </>
  );
}

function Meter({
  label,
  used,
  limit,
  unit = "",
  divisor = 1,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  divisor?: number;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-ink-400">
        <span>{label}</span>
        <span className="mono text-ink-300">
          {unit}
          {(used / divisor).toLocaleString()} / {unit}
          {(limit / divisor).toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-900">
        <div
          className="h-full rounded-full bg-accent-600"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
