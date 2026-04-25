"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RevokeKeyButton({ keyId }: { keyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Revoke this key? Any service using it will start getting 401s immediately.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.detail ?? "Could not revoke key.");
      }
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-red-400 hover:text-red-300 disabled:opacity-60"
    >
      {busy ? "Revoking…" : "Revoke"}
    </button>
  );
}
