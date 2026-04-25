"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IssueKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ plaintext: string; prefix: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? "Could not issue key.");
        return;
      }
      setIssued({ plaintext: body.plaintext, prefix: body.key.prefix });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function close() {
    setOpen(false);
    setIssued(null);
    setName("");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
      >
        Issue key
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-ink-800 bg-ink-950 p-5 shadow-xl">
            {!issued ? (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-50">Issue API key</h2>
                  <p className="mt-1 text-xs text-ink-500">
                    The plaintext key will be shown <em>once</em>, then only the prefix is
                    stored. Copy it somewhere safe immediately.
                  </p>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-ink-300">Name</span>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="production / staging / intern-sandbox"
                    required
                    className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
                  />
                </label>
                {error && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
                  >
                    {busy ? "Issuing…" : "Issue"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-50">Key issued</h2>
                  <p className="mt-1 text-xs text-amber-300">
                    This is the only time you'll see the plaintext. Copy it now.
                  </p>
                </div>
                <pre className="mono break-all rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-ink-100">
                  {issued.plaintext}
                </pre>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    className="rounded-md border border-ink-800 bg-ink-900 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
