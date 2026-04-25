import { createHmac } from "node:crypto";

// Webhook signature format: "t=<unix_ts>,v1=<hex hmac-sha256 of `${ts}.${body}`>".
// Matches the convention from Developer Guide §7.7.
export function signWebhookBody(secret: string, ts: number, body: string): string {
  const h = createHmac("sha256", secret);
  h.update(`${ts}.${body}`);
  return `t=${ts},v1=${h.digest("hex")}`;
}
