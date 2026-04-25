"use client";

import { useState } from "react";

export default function PlanSwitchButtons({
  currentPlan,
  stripeReady,
}: {
  currentPlan: string;
  stripeReady: boolean;
}) {
  const [busy, setBusy] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  async function start(target: "pro" | "starter") {
    setBusy("checkout");
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.href = body.url as string;
        return;
      }
      setError(body.detail ?? "Could not start checkout.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function portal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.href = body.url as string;
        return;
      }
      setError(body.detail ?? "Could not open portal.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (!stripeReady) {
    return (
      <div className="text-[11px] text-ink-500">
        Plan switching requires <span className="mono">STRIPE_SECRET_KEY</span> +{" "}
        <span className="mono">STRIPE_PRICE_PRO</span> in the environment. The plan can still be
        flipped manually via SQL until Stripe is wired.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {currentPlan !== "pro" && (
          <button
            type="button"
            onClick={() => start("pro")}
            disabled={busy !== null}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {busy === "checkout" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        )}
        <button
          type="button"
          onClick={portal}
          disabled={busy !== null}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800 disabled:opacity-60"
        >
          {busy === "portal" ? "Opening…" : "Stripe portal"}
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
