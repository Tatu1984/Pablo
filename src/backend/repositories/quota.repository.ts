import { query } from "@/backend/database/client";

export interface QuotaRow {
  org_id: string;
  period: string;
  runs_used: number;
  runs_limit: number;
  tokens_used: number;
  tokens_limit: number;
  cost_cents_used: number;
  updated_at: string;
}

// Upsert the meter row for (orgId, period) with the limits from the org's
// active plan. Returns the current state. We RETURNING the existing row on
// conflict so the call is idempotent — the limits get refreshed in case
// the plan changed mid-period.
export async function upsertQuota(
  orgId: string,
  period: string,
  runsLimit: number,
  tokensLimit: number,
): Promise<QuotaRow> {
  const rows = await query<QuotaRow>(
    `INSERT INTO quotas (org_id, period, runs_limit, tokens_limit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, period) DO UPDATE
        SET runs_limit = EXCLUDED.runs_limit,
            tokens_limit = EXCLUDED.tokens_limit,
            updated_at = now()
     RETURNING org_id, period, runs_used, runs_limit, tokens_used, tokens_limit,
               cost_cents_used,
               to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
    [orgId, period, runsLimit, tokensLimit],
  );
  return rows[0];
}

export async function getQuota(
  orgId: string,
  period: string,
): Promise<QuotaRow | null> {
  const rows = await query<QuotaRow>(
    `SELECT org_id, period, runs_used, runs_limit, tokens_used, tokens_limit,
            cost_cents_used,
            to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM quotas
      WHERE org_id = $1 AND period = $2`,
    [orgId, period],
  );
  return rows[0] ?? null;
}

// Atomic counter increments. Returns the new totals so callers can decide
// to fire a quota.threshold notification if a cross-percentile boundary
// has been crossed.
export async function incrementUsage(
  orgId: string,
  period: string,
  runsDelta: number,
  tokensDelta: number,
  costDelta: number,
): Promise<QuotaRow | null> {
  const rows = await query<QuotaRow>(
    `UPDATE quotas
        SET runs_used       = runs_used + $3,
            tokens_used     = tokens_used + $4,
            cost_cents_used = cost_cents_used + $5,
            updated_at      = now()
      WHERE org_id = $1 AND period = $2
      RETURNING org_id, period, runs_used, runs_limit, tokens_used, tokens_limit,
                cost_cents_used,
                to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
    [orgId, period, runsDelta, tokensDelta, costDelta],
  );
  return rows[0] ?? null;
}
