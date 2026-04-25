import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import PlanSwitchButtons from "@/frontend/components/features/billing/PlanSwitchButtons";
import { quotaForOrg } from "@/backend/services/quota.service";
import { ensureSubscription } from "@/backend/repositories/subscription.repository";
import { requireSession } from "@/backend/services/session.service";
import { PLANS, planFor } from "@/shared/constants/plans";

export default async function BillingPage() {
  const { org } = await requireSession();
  const [sub, quota] = await Promise.all([
    ensureSubscription(org.id),
    quotaForOrg(org.id),
  ]);
  const plan = planFor(sub.plan);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <PageFrame>
      <PageHeader
        title="Billing"
        description="Plan, quota meters, and Stripe integration. Pablo owns the limits; Stripe owns the price."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-100">Plan</h2>
              <p className="mt-1 text-xs text-ink-500">{plan.description}</p>
            </div>
            <span className="rounded border border-accent-600/40 bg-accent-600/10 px-2 py-0.5 text-[11px] font-medium text-accent-600">
              {plan.label}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <KV label="Tokens / month" value={plan.tokens_limit.toLocaleString()} />
            <KV label="Runs / month" value={plan.runs_limit.toLocaleString()} />
            <KV
              label="Price"
              value={
                plan.monthly_price_cents > 0
                  ? `$${(plan.monthly_price_cents / 100).toFixed(0)}/mo`
                  : "—"
              }
            />
            <KV label="Status" value={sub.status} />
            <KV label="Current period" value={quota.period} />
            <KV
              label="Renews"
              value={sub.current_period_end ? sub.current_period_end.slice(0, 10) : "—"}
            />
          </dl>

          <div className="mt-5">
            <PlanSwitchButtons currentPlan={plan.id} stripeReady={stripeReady} />
          </div>
        </section>

        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
          <h2 className="text-sm font-semibold text-ink-100">This period</h2>
          <dl className="mt-4 flex flex-col gap-3 text-xs">
            <Meter label="Tokens" used={quota.tokens_used} limit={quota.tokens_limit} />
            <Meter label="Runs" used={quota.runs_used} limit={quota.runs_limit} />
            <Meter
              label="Cost"
              used={quota.cost_cents_used}
              limit={Math.max(quota.cost_cents_used, 1)}
              unit="$"
              divisor={100}
            />
          </dl>
          <p className="mt-4 text-[11px] text-ink-500">
            Quotas reset at the start of each calendar month (UTC).
          </p>
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-100">Plans</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Object.values(PLANS).map((p) => (
            <article
              key={p.id}
              className={`rounded-lg border p-5 ${
                p.id === plan.id
                  ? "border-accent-600/50 bg-accent-600/5"
                  : "border-ink-800 bg-ink-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink-100">{p.label}</h4>
                <span className="mono text-[11px] text-ink-400">
                  {p.monthly_price_cents > 0
                    ? `$${(p.monthly_price_cents / 100).toFixed(0)}/mo`
                    : "free"}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-400">{p.description}</p>
              <ul className="mt-3 flex flex-col gap-1 text-[11px] text-ink-300">
                <li>
                  <span className="mono">{p.tokens_limit.toLocaleString()}</span> tokens / month
                </li>
                <li>
                  <span className="mono">{p.runs_limit.toLocaleString()}</span> runs / month
                </li>
              </ul>
            </article>
          ))}
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
  const pct = Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0);
  const tone = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-accent-600";
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
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
