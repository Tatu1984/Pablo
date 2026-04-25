import Link from "next/link";
import type { RunStatus } from "@/shared/types/run.types";

const STATUSES: (RunStatus | "all")[] = [
  "all",
  "running",
  "queued",
  "completed",
  "failed",
  "cancelled",
];

// Path-preserving filter pills. Pass the base URL (e.g. "/runs" or
// "/agents/<id>/runs"). The component reads the status from `current` and
// builds links that swap it.
export default function StatusFilter({
  basePath,
  current,
}: {
  basePath: string;
  current?: RunStatus;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {STATUSES.map((s) => {
        const active = (s === "all" && !current) || s === current;
        const href = s === "all" ? basePath : `${basePath}?status=${s}`;
        return (
          <Link
            key={s}
            href={href}
            className={`mono rounded border px-2 py-1 text-[11px] transition ${
              active
                ? "border-accent-600/50 bg-accent-600/10 text-accent-600"
                : "border-ink-800 bg-ink-950 text-ink-400 hover:bg-ink-900 hover:text-ink-200"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </div>
  );
}
