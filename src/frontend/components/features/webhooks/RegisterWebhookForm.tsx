"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const ALL_EVENTS = [
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "quota.threshold",
  "subscription.updated",
];

export default function RegisterWebhookForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssuedSecret(null);

    const form = new FormData(e.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    const events = form.getAll("events").map(String);
    if (events.length === 0) {
      setError("Select at least one event.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? "Could not register webhook.");
        return;
      }
      setIssuedSecret(body.secret);
      router.refresh();
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-ink-100">Register webhook</h3>
        <p className="mt-1 text-xs text-ink-500">
          We sign every request with <span className="mono">X-Pablo-Signature</span>: HMAC-SHA256
          of <span className="mono">{`{ts}.{body}`}</span> using a per-webhook secret.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">URL</span>
        <input
          type="url"
          name="url"
          required
          placeholder="https://example.com/hooks/pablo"
          className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
        />
      </label>

      <div>
        <span className="text-sm text-ink-300">Events</span>
        <ul className="mt-2 flex flex-col gap-2">
          {ALL_EVENTS.map((e) => (
            <li key={e} className="flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                name="events"
                value={e}
                defaultChecked={e.startsWith("execution.")}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-900 text-accent-600"
              />
              <span className="mono text-ink-200">{e}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {issuedSecret && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
          <div className="font-medium text-amber-300">
            Webhook registered. Save this signing secret — it is shown once.
          </div>
          <pre className="mono break-all rounded bg-ink-900 px-2 py-1 text-ink-100">
            {issuedSecret}
          </pre>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {busy ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
