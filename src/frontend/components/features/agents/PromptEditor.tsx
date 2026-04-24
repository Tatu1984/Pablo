"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface PromptVersion {
  id: string;
  version: string;
  note: string | null;
  created_at: string;
}

export default function PromptEditor({
  agentId,
  currentVersion,
  versions,
  initial,
}: {
  agentId: string;
  currentVersion: string;
  versions: PromptVersion[];
  initial: {
    system_prompt: string;
    task_prompt: string;
    tool_instructions: string;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      system_prompt: String(form.get("system_prompt") ?? ""),
      task_prompt: String(form.get("task_prompt") ?? ""),
      tool_instructions: String(form.get("tool_instructions") ?? ""),
      note: String(form.get("note") ?? ""),
    };

    try {
      const res = await fetch(`/api/agents/${agentId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { prompt_version } = await res.json();
        setOk(`Published ${prompt_version.version}.`);
        router.refresh();
      } else {
        const p = await res.json().catch(() => ({}));
        setError(p?.detail ?? "Could not publish prompt.");
      }
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-100">Prompt editor</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Saving publishes a new version. Old versions stay immutable for replay.
            </p>
          </div>
          <span className="mono text-[11px] text-ink-500">current: {currentVersion}</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">System prompt</span>
          <textarea
            name="system_prompt"
            rows={6}
            defaultValue={initial.system_prompt}
            className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Task prompt</span>
          <textarea
            name="task_prompt"
            rows={7}
            defaultValue={initial.task_prompt}
            className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Tool instructions</span>
          <textarea
            name="tool_instructions"
            rows={4}
            defaultValue={initial.tool_instructions}
            className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Version note (optional)</span>
          <input
            name="note"
            maxLength={200}
            placeholder="Tighter JSON coercion"
            className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </div>
        )}
        {ok && (
          <div
            role="status"
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
          >
            {ok}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {loading ? "Publishing…" : "Publish new version"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
        <h3 className="text-sm font-semibold text-ink-100">Prompt versions</h3>
        <ul className="mt-3 flex flex-col divide-y divide-ink-800">
          {versions.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-xs">
              <div>
                <div className="mono text-ink-100">{p.version}</div>
                {p.note && <div className="text-ink-500">{p.note}</div>}
              </div>
              <div className="text-right text-[10px] text-ink-500">
                <div>{p.created_at.slice(0, 10)}</div>
                {p.version === currentVersion && (
                  <div className="mt-1 inline-flex rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-400">
                    live
                  </div>
                )}
              </div>
            </li>
          ))}
          {versions.length === 0 && (
            <li className="py-2 text-xs text-ink-500">No versions yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
