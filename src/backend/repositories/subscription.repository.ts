import { query } from "@/backend/database/client";

export interface SubscriptionRow {
  org_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  current_period_end: string | null;
  updated_at: string;
}

export async function getSubscription(orgId: string): Promise<SubscriptionRow | null> {
  const rows = await query<SubscriptionRow>(
    `SELECT org_id, plan, status, stripe_customer_id, stripe_sub_id,
            to_char(current_period_end, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS current_period_end,
            to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM subscriptions
      WHERE org_id = $1`,
    [orgId],
  );
  return rows[0] ?? null;
}

// Upsert a row so every org always has an entry (default = starter / active).
export async function ensureSubscription(orgId: string): Promise<SubscriptionRow> {
  const rows = await query<SubscriptionRow>(
    `INSERT INTO subscriptions (org_id, plan, status)
     VALUES ($1, 'starter', 'active')
     ON CONFLICT (org_id) DO UPDATE SET updated_at = subscriptions.updated_at
     RETURNING org_id, plan, status, stripe_customer_id, stripe_sub_id,
               to_char(current_period_end, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS current_period_end,
               to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
    [orgId],
  );
  return rows[0];
}

export async function setSubscriptionPlan(
  orgId: string,
  patch: {
    plan?: string;
    status?: string;
    stripe_customer_id?: string | null;
    stripe_sub_id?: string | null;
    current_period_end?: Date | null;
  },
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (org_id, plan, status, stripe_customer_id, stripe_sub_id, current_period_end)
     VALUES ($1, COALESCE($2, 'starter'), COALESCE($3, 'active'), $4, $5, $6)
     ON CONFLICT (org_id) DO UPDATE
        SET plan = COALESCE($2, subscriptions.plan),
            status = COALESCE($3, subscriptions.status),
            stripe_customer_id = COALESCE($4, subscriptions.stripe_customer_id),
            stripe_sub_id = COALESCE($5, subscriptions.stripe_sub_id),
            current_period_end = COALESCE($6, subscriptions.current_period_end),
            updated_at = now()`,
    [
      orgId,
      patch.plan ?? null,
      patch.status ?? null,
      patch.stripe_customer_id ?? null,
      patch.stripe_sub_id ?? null,
      patch.current_period_end ?? null,
    ],
  );
}

export async function findOrgIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const rows = await query<{ org_id: string }>(
    `SELECT org_id FROM subscriptions WHERE stripe_customer_id = $1`,
    [customerId],
  );
  return rows[0]?.org_id ?? null;
}
