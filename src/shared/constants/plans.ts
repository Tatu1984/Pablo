// Plan tiers, defined in code so the limits are version-controlled and the
// quota enforcement layer always agrees with what the UI advertises. Stripe
// holds the *price* (and which org subscribed); Pablo holds the *limits*.

export type PlanId = "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  label: string;
  monthly_price_cents: number;
  // Limits per calendar month (UTC).
  runs_limit: number;
  tokens_limit: number;
  // Optional Stripe price id — if env is wired, used by the checkout flow.
  stripe_price_env: string | null;
  description: string;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    label: "Starter",
    monthly_price_cents: 0,
    runs_limit: 100,
    tokens_limit: 500_000,
    stripe_price_env: null,
    description: "Free tier. Plenty for experiments and personal projects.",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthly_price_cents: 2_900,
    runs_limit: 2_000,
    tokens_limit: 10_000_000,
    stripe_price_env: "STRIPE_PRICE_PRO",
    description: "For teams running real agents in production.",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    monthly_price_cents: 0, // contact sales
    runs_limit: 100_000,
    tokens_limit: 1_000_000_000,
    stripe_price_env: null,
    description: "Custom limits, dedicated support, on-prem deployments.",
  },
};

export function planFor(id: string | null | undefined): Plan {
  const key = (id ?? "starter") as PlanId;
  return PLANS[key] ?? PLANS.starter;
}

export function currentPeriod(at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
