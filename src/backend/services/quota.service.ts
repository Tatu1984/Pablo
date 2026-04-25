import {
  getQuota,
  incrementUsage,
  upsertQuota,
  type QuotaRow,
} from "@/backend/repositories/quota.repository";
import {
  ensureSubscription,
} from "@/backend/repositories/subscription.repository";
import { currentPeriod, planFor } from "@/shared/constants/plans";

export class QuotaError extends Error {
  constructor(
    public code: "runs_exceeded" | "tokens_exceeded",
    message: string,
    public quota: QuotaRow,
  ) {
    super(message);
  }
}

// Always called with the org's current plan in mind. Returns the live
// quota row (and refreshes the limits for the period in case the org's
// plan has changed). Cheap; safe to call before every run.
export async function quotaForOrg(orgId: string): Promise<QuotaRow> {
  const sub = await ensureSubscription(orgId);
  const plan = planFor(sub.plan);
  const period = currentPeriod();
  return upsertQuota(orgId, period, plan.runs_limit, plan.tokens_limit);
}

// Throws QuotaError if either ceiling has already been hit. Called
// before a new run is inserted.
export async function assertCanRun(orgId: string): Promise<QuotaRow> {
  const q = await quotaForOrg(orgId);
  if (q.runs_used >= q.runs_limit) {
    throw new QuotaError(
      "runs_exceeded",
      `Plan limit hit: ${q.runs_used}/${q.runs_limit} runs used in ${q.period}.`,
      q,
    );
  }
  if (q.tokens_used >= q.tokens_limit) {
    throw new QuotaError(
      "tokens_exceeded",
      `Plan limit hit: ${q.tokens_used.toLocaleString()}/${q.tokens_limit.toLocaleString()} tokens used in ${q.period}.`,
      q,
    );
  }
  return q;
}

// Best-effort meter update — called when a run reaches a terminal state.
// Failures here should not bubble back to the caller; we log + move on.
export async function recordRunUsage(
  orgId: string,
  tokensIn: number,
  tokensOut: number,
  costCents = 0,
): Promise<void> {
  try {
    const period = currentPeriod();
    // Make sure the row exists for this period (handles month rollover
    // mid-run) before incrementing.
    await ensureSubscription(orgId);
    await getOrCreateForCurrentPeriod(orgId);
    await incrementUsage(orgId, period, 1, tokensIn + tokensOut, costCents);
  } catch (err) {
    console.error("recordRunUsage failed:", err);
  }
}

async function getOrCreateForCurrentPeriod(orgId: string): Promise<QuotaRow> {
  const period = currentPeriod();
  const existing = await getQuota(orgId, period);
  if (existing) return existing;
  return quotaForOrg(orgId);
}
