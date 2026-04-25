"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProviderRowActions({
  providerId,
  deletable,
}: {
  providerId: string;
  deletable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "test" | "delete">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onTest() {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/test`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setMsg({ kind: "ok", text: body.message ?? "Probe succeeded." });
      } else {
        setMsg({ kind: "err", text: body.message ?? body.detail ?? "Probe failed." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Probe failed." });
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!confirm("Remove this provider? Any agents using it will need to be reassigned.")) return;
    setBusy("delete");
    setMsg(null);
    try {
      const res = await fetch(`/api/providers/${providerId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: body.detail ?? "Could not remove provider." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        <Link
          href={`/providers/${providerId}/edit`}
          className="text-ink-300 hover:text-ink-100"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={onTest}
          disabled={busy !== null}
          className="text-ink-300 hover:text-ink-100 disabled:opacity-60"
        >
          {busy === "test" ? "Testing…" : "Test"}
        </button>
        {deletable && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy !== null}
            className="text-red-400 hover:text-red-300 disabled:opacity-60"
          >
            {busy === "delete" ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {msg && (
        <span
          role={msg.kind === "ok" ? "status" : "alert"}
          className={`max-w-[260px] truncate text-right text-[11px] ${
            msg.kind === "ok" ? "text-emerald-400" : "text-red-400"
          }`}
          title={msg.text}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
