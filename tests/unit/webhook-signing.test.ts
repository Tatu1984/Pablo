import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhookBody as signBody } from "@/backend/utils/sign.util";

describe("webhook signBody", () => {
  it("formats as t=<unix>,v1=<hex>", () => {
    const sig = signBody("whsec_test", 1_700_000_000, "{}");
    expect(sig).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it("matches a manual HMAC-SHA256 over `{ts}.{body}`", () => {
    const ts = 1_700_000_000;
    const body = '{"hello":"world"}';
    const expected = createHmac("sha256", "whsec_test").update(`${ts}.${body}`).digest("hex");
    expect(signBody("whsec_test", ts, body)).toBe(`t=${ts},v1=${expected}`);
  });

  it("changes when secret changes", () => {
    expect(signBody("a", 1, "x")).not.toBe(signBody("b", 1, "x"));
  });
});
