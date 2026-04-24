import { RunStatus, statusColor } from "@/lib/mock";

export default function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusColor(
        status,
      )}`}
    >
      {status}
    </span>
  );
}
