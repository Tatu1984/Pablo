"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import ProviderModelPicker from "@/frontend/components/features/agents/ProviderModelPicker";
import type { Agent } from "@/shared/types/agent.types";
import type { Provider } from "@/shared/types/provider.types";

export default function EditAgentConfigForm({
  agent,
  providers,
}: {
  agent: Agent;
  providers: Provider[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(false);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      execution_mode: String(form.get("execution_mode") ?? "one_shot"),
      provider_id: String(form.get("provider_id") ?? ""),
      model: String(form.get("model") ?? ""),
    };

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOk(true);
        router.refresh();
      } else {
        const p = await res.json().catch(() => ({}));
        setError(p?.detail ?? "Could not save configuration.");
      }
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
      <h2 className="text-sm font-semibold text-ink-100">Configuration</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Name</span>
        <input
          name="name"
          defaultValue={agent.name}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Description</span>
        <input
          name="description"
          defaultValue={agent.description}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Execution mode</span>
        <select
          name="execution_mode"
          defaultValue={agent.execution_mode}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        >
          <option value="one_shot">one_shot</option>
          <option value="multi_step_loop">multi_step_loop</option>
          <option value="event_triggered">event_triggered</option>
        </select>
      </label>

      <ProviderModelPicker
        providers={providers}
        providerId={agent.provider_id}
        model={agent.model}
      />

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
          Configuration saved.
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save configuration"}
        </button>
      </div>
    </form>
  );
}
