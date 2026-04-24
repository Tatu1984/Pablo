"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import ProviderModelPicker from "@/frontend/components/features/agents/ProviderModelPicker";
import { TOOLS } from "@/shared/constants/tools";
import type { Provider } from "@/shared/types/provider.types";

interface ProblemJson {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export default function NewAgentForm({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const tools = form.getAll("tools").map(String);
    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      role: String(form.get("role") ?? ""),
      execution_mode: String(form.get("execution_mode") ?? "one_shot"),
      provider_id: String(form.get("provider_id") ?? ""),
      model: String(form.get("model") ?? ""),
      tools,
      limits: {
        max_steps: Number(form.get("max_steps")),
        max_runtime_ms: Number(form.get("max_runtime_ms")),
        max_tool_calls: Number(form.get("max_tool_calls")),
        max_tokens_per_run: Number(form.get("max_tokens_per_run")),
      },
      input_schema: String(form.get("input_schema") ?? ""),
      output_schema: String(form.get("output_schema") ?? ""),
    };

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const { agent } = await res.json();
        router.push(`/agents/${agent.id}`);
        router.refresh();
        return;
      }

      const problem: ProblemJson = await res.json().catch(() => ({}));
      if (problem.errors) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(problem.errors)) flat[k] = v[0] ?? "";
        setFieldErrors(flat);
      }
      setError(problem.detail ?? "Could not create agent.");
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-3" noValidate>
      <section className="md:col-span-2 flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
        <Field
          label="Name"
          hint="Shown in logs and billing."
          error={fieldErrors.name}
        >
          <input
            name="name"
            required
            placeholder="daily-sales-digest"
            className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
          />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <input
            name="description"
            className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
            placeholder="Summarises yesterday's sales from the CRM."
          />
        </Field>

        <Field label="Role / persona" hint="Shown in the chat header." error={fieldErrors.role}>
          <input
            name="role"
            className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
            placeholder="Sales Analyst"
          />
        </Field>

        <Field label="Execution mode">
          <select
            name="execution_mode"
            defaultValue="one_shot"
            className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
          >
            <option value="one_shot">one_shot</option>
            <option value="multi_step_loop">multi_step_loop</option>
            <option value="event_triggered">event_triggered</option>
          </select>
        </Field>

        <ProviderModelPicker providers={providers} />

        <Field label="Input schema (JSON Schema)" error={fieldErrors.input_schema}>
          <textarea
            name="input_schema"
            rows={6}
            defaultValue={`{
  "type": "object",
  "required": ["date"],
  "properties": { "date": { "type": "string", "format": "date" } }
}`}
            className="mono w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
        </Field>

        <Field label="Output schema (JSON Schema)" error={fieldErrors.output_schema}>
          <textarea
            name="output_schema"
            rows={5}
            defaultValue={`{
  "type": "object",
  "required": ["summary"],
  "properties": { "summary": { "type": "string" } }
}`}
            className="mono w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
        </Field>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
          <h2 className="text-sm font-semibold text-ink-100">Tool allowlist</h2>
          <p className="mt-1 text-xs text-ink-500">
            Only tools ticked here can be invoked by this agent.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {TOOLS.map((t) => (
              <li key={t.name} className="flex items-start gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  name="tools"
                  value={t.name}
                  defaultChecked={t.name === "http.request" || t.name === "json.transform"}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-ink-700 bg-ink-900 text-accent-600"
                />
                <div>
                  <span className="mono text-ink-100">{t.name}</span>
                  <div className="text-ink-500">{t.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
          <h2 className="text-sm font-semibold text-ink-100">Limits</h2>
          <p className="mt-1 text-xs text-ink-500">
            Hard caps. Execution fails at boundary — no surprise bills.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <NumField label="max_steps" name="max_steps" defaultValue={12} />
            <NumField label="max_runtime_ms" name="max_runtime_ms" defaultValue={60000} />
            <NumField label="max_tool_calls" name="max_tool_calls" defaultValue={20} />
            <NumField
              label="max_tokens_per_run"
              name="max_tokens_per_run"
              defaultValue={40000}
            />
          </div>
        </section>
      </aside>

      {error && (
        <div
          role="alert"
          className="md:col-span-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      <div className="md:col-span-3 flex items-center justify-end gap-2">
        <Link
          href="/agents"
          className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create agent"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-300">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] text-red-400">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}

function NumField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink-300">
      <span className="mono text-ink-400">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={1}
        className="mono w-28 rounded-md border border-ink-800 bg-ink-900 px-2 py-1 text-right text-xs outline-none focus:border-accent-600"
      />
    </label>
  );
}
