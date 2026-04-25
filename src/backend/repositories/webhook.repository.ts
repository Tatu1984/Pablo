import { query } from "@/backend/database/client";

export interface WebhookRow {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  created_at: string;
  disabled_at: string | null;
}

const COLS = `id, org_id, url, events,
  to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(disabled_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS disabled_at`;

export async function listWebhooks(orgId: string): Promise<WebhookRow[]> {
  return query<WebhookRow>(
    `SELECT ${COLS} FROM webhooks WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId],
  );
}

export async function getWebhook(orgId: string, id: string): Promise<WebhookRow | null> {
  const rows = await query<WebhookRow>(
    `SELECT ${COLS} FROM webhooks WHERE id = $1 AND org_id = $2`,
    [id, orgId],
  );
  return rows[0] ?? null;
}

export async function getWebhookSecret(id: string): Promise<{ url: string; secret: string } | null> {
  const rows = await query<{ url: string; secret: string }>(
    `SELECT url, secret FROM webhooks WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Active webhooks for an org filtered to those subscribed to `event`.
// Used by the dispatcher when a run reaches a terminal state.
export async function listActiveWebhooksForEvent(
  orgId: string,
  event: string,
): Promise<{ id: string; url: string; secret: string }[]> {
  return query<{ id: string; url: string; secret: string }>(
    `SELECT id, url, secret
       FROM webhooks
      WHERE org_id = $1
        AND disabled_at IS NULL
        AND events @> to_jsonb($2::text)`,
    [orgId, event],
  );
}

export async function insertWebhook(
  id: string,
  orgId: string,
  url: string,
  events: string[],
  secret: string,
): Promise<WebhookRow> {
  const rows = await query<WebhookRow>(
    `INSERT INTO webhooks (id, org_id, url, events, secret)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING ${COLS}`,
    [id, orgId, url, JSON.stringify(events), secret],
  );
  return rows[0];
}

export async function deleteWebhook(orgId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM webhooks WHERE id = $1 AND org_id = $2 RETURNING id`,
    [id, orgId],
  );
  return rows.length > 0;
}

// ─── deliveries ─────────────────────────────────────────────────────────────

export interface DeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  attempt: number;
  last_status: number | null;
  last_error: string | null;
  created_at: string;
  last_attempt_at: string | null;
}

export async function insertDelivery(
  id: string,
  webhookId: string,
  event: string,
  payload: unknown,
): Promise<DeliveryRow> {
  const rows = await query<DeliveryRow>(
    `INSERT INTO webhook_deliveries (id, webhook_id, event, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, webhook_id, event, status, attempt, last_status, last_error,
               to_char(created_at,      'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
               to_char(last_attempt_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_attempt_at`,
    [id, webhookId, event, JSON.stringify(payload)],
  );
  return rows[0];
}

export async function recordAttempt(
  id: string,
  attempt: number,
  status: "delivered" | "retrying" | "failed",
  lastStatus: number | null,
  lastError: string | null,
): Promise<void> {
  await query(
    `UPDATE webhook_deliveries
        SET attempt         = $2,
            status          = $3,
            last_status     = $4,
            last_error      = $5,
            last_attempt_at = now()
      WHERE id = $1`,
    [id, attempt, status, lastStatus, lastError],
  );
}

export async function listDeliveries(orgId: string, limit = 50): Promise<
  (DeliveryRow & { url: string })[]
> {
  return query<DeliveryRow & { url: string }>(
    `SELECT d.id, d.webhook_id, d.event, d.status, d.attempt, d.last_status, d.last_error,
            to_char(d.created_at,      'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(d.last_attempt_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_attempt_at,
            w.url
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
      WHERE w.org_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2`,
    [orgId, limit],
  );
}
