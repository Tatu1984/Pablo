"use client";

import { useState } from "react";

export default function JsonView({
  value,
  collapsed = true,
  label,
}: {
  value: unknown;
  collapsed?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(!collapsed);
  const text = JSON.stringify(value, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-md border border-ink-800 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-800 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-[11px] font-medium text-ink-300 hover:text-ink-100"
        >
          <span aria-hidden className="mono text-ink-500">
            {open ? "▾" : "▸"}
          </span>
          {label ?? "JSON"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] text-ink-400 hover:text-ink-200"
        >
          Copy
        </button>
      </div>
      {open && (
        <pre className="mono max-h-80 overflow-auto px-3 py-2 text-[11px] leading-relaxed text-ink-200">
          {text}
        </pre>
      )}
    </div>
  );
}
