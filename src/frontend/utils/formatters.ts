import type { RunStatus } from "@/shared/types/run.types";

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").replace(".000Z", "Z");
}

export function statusColor(s: RunStatus): string {
  switch (s) {
    case "completed":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "failed":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "running":
      return "text-sky-400 bg-sky-500/10 border-sky-500/30";
    case "queued":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "cancelled":
      return "text-ink-400 bg-ink-500/10 border-ink-500/30";
  }
}
