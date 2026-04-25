import { createHmac, randomBytes } from "node:crypto";
import {
  deleteWebhook,
  getWebhook,
  getWebhookSecret,
  insertDelivery,
  insertWebhook,
  listActiveWebhooksForEvent,
  listDeliveries,
  listWebhooks,
  recordAttempt,
  type WebhookRow,
} from "@/backend/repositories/webhook.repository";
import { newId } from "@/backend/utils/id.util";

export type WebhookEvent =
  | "execution.completed"
  | "execution.failed"
  | "execution.cancelled"
  | "quota.threshold"
  | "subscription.updated";

export const ALL_EVENTS: WebhookEvent[] = [
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "quota.threshold",
  "subscription.updated",
];

export class WebhookError extends Error {
  constructor(
    public code: "not_found" | "invalid_event" | "invalid_url",
    message: string,
  ) {
    super(message);
  }
}

export interface IssuedWebhook {
  row: WebhookRow;
  secret: string; // shown exactly once at creation
}

export async function registerWebhook(
  orgId: string,
  url: string,
  events: string[],
): Promise<IssuedWebhook> {
  // Quick URL sanity — the validator on the route already rejects malformed
  // URLs, but defence in depth here too.
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new WebhookError("invalid_url", `Unsupported protocol: ${u.protocol}`);
    }
  } catch {
    throw new WebhookError("invalid_url", "Invalid URL.");
  }

  const validated: WebhookEvent[] = [];
  for (const e of events) {
    if (!ALL_EVENTS.includes(e as WebhookEvent)) {
      throw new WebhookError("invalid_event", `Unknown event: ${e}`);
    }
    validated.push(e as WebhookEvent);
  }

  const id = newId("wh");
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const row = await insertWebhook(id, orgId, url, validated, secret);
  return { row, secret };
}

export async function listAllWebhooks(orgId: string) {
  return listWebhooks(orgId);
}

export async function listRecentDeliveries(orgId: string) {
  return listDeliveries(orgId, 50);
}

export async function getWebhookForOrg(orgId: string, id: string) {
  return getWebhook(orgId, id);
}

export async function removeWebhook(orgId: string, id: string) {
  const ok = await deleteWebhook(orgId, id);
  if (!ok) throw new WebhookError("not_found", "Webhook not found.");
}

// ─── delivery ───────────────────────────────────────────────────────────────

const SIGNING_VERSION = "v1";
const RETRY_DELAYS_MS = [0, 1_000, 5_000, 30_000];

export interface DeliveryAttemptResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

export function signBody(secret: string, ts: number, body: string): string {
  const h = createHmac("sha256", secret);
  h.update(`${ts}.${body}`);
  return `t=${ts},${SIGNING_VERSION}=${h.digest("hex")}`;
}

async function attemptOnce(
  url: string,
  secret: string,
  body: string,
): Promise<DeliveryAttemptResult> {
  const ts = Math.floor(Date.now() / 1000);
  const signature = signBody(secret, ts, body);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pablo-signature": signature,
        "user-agent": "Pablo-Webhook/1.0",
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      error: ok ? null : `Upstream returned ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Fire a single webhook with retry. Logs attempts on the deliveries table.
export async function deliverEvent(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const deliveryId = newId("whd");
  await insertDelivery(deliveryId, webhookId, event, payload);

  const body = JSON.stringify({ id: deliveryId, event, data: payload });
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    const res = await attemptOnce(url, secret, body);
    if (res.ok) {
      await recordAttempt(deliveryId, attempt + 1, "delivered", res.status, null);
      return;
    }
    const isLast = attempt === RETRY_DELAYS_MS.length - 1;
    await recordAttempt(
      deliveryId,
      attempt + 1,
      isLast ? "failed" : "retrying",
      res.status,
      res.error,
    );
    if (isLast) return;
  }
}

// Fan-out: look up active subscribers for the event in this org and
// deliver to each. Fire-and-forget — callers should not await this on the
// hot path (it can take up to ~36s in worst-case retry).
export async function dispatchEvent(
  orgId: string,
  event: WebhookEvent,
  payload: unknown,
): Promise<void> {
  const subs = await listActiveWebhooksForEvent(orgId, event);
  if (subs.length === 0) return;
  await Promise.allSettled(
    subs.map((s) => deliverEvent(s.id, s.url, s.secret, event, payload)),
  );
}

// One-off "ping" used by the UI Test button.
export async function testWebhook(orgId: string, id: string): Promise<DeliveryAttemptResult> {
  const wh = await getWebhook(orgId, id);
  if (!wh) throw new WebhookError("not_found", "Webhook not found.");
  const secrets = await getWebhookSecret(id);
  if (!secrets) throw new WebhookError("not_found", "Webhook secret missing.");
  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    event: "test",
    data: { sent_at: new Date(ts * 1000).toISOString(), webhook_id: id },
  });
  return attemptOnce(secrets.url, secrets.secret, body);
}
