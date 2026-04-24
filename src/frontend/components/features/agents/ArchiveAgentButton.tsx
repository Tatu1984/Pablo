"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ArchiveAgentButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm("Archive this agent? Runs and traces are retained.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/agents");
        router.refresh();
      } else {
        const p = await res.json().catch(() => ({}));
        setError(p?.detail ?? "Could not archive agent.");
      }
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60"
      >
        {loading ? "Archiving…" : "Archive agent"}
      </button>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300"
        >
          {error}
        </div>
      )}
    </div>
  );
}
