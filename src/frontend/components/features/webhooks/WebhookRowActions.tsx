"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function WebhookRowActions({ webhookId }: { webhookId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "test" | "remove">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onTest() {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/test`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setMsg({ kind: "ok", text: `Delivered (${body.status})` });
      } else {
        setMsg({
          kind: "err",
          text: body.error ?? body.detail ?? `Failed${body.status ? ` (${body.status})` : ""}`,
        });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    if (!confirm("Remove this webhook? Future events won't be delivered to it.")) return;
    setBusy("remove");
    setMsg(null);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: body.detail ?? "Could not remove." });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTest}
          disabled={busy !== null}
          className="text-ink-300 hover:text-ink-100 disabled:opacity-60"
        >
          {busy === "test" ? "Testing…" : "Test"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy !== null}
          className="text-red-400 hover:text-red-300 disabled:opacity-60"
        >
          {busy === "remove" ? "Removing…" : "Remove"}
        </button>
      </div>
      {msg && (
        <span
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
