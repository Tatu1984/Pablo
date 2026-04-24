import Link from "next/link";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import ProviderModelPicker from "@/components/ProviderModelPicker";
import { TOOLS } from "@/lib/mock";
import { getProviders } from "@/lib/queries";

export default async function NewAgentPage() {
  const providers = await getProviders();
  return (
    <PageFrame>
      <PageHeader
        crumbs={[{ href: "/agents", label: "Agents" }, { label: "New" }]}
        title="Create agent"
        description="A name, an input schema, a tool allowlist, and hard limits. Prompt versions are edited separately after creation."
      />

      <form className="grid grid-cols-1 gap-6 md:grid-cols-3" action="/agents">
        <section className="md:col-span-2 flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
          <Field label="Name" hint="Kebab-case, shown in logs and billing.">
            <input
              name="name"
              required
              placeholder="daily-sales-digest"
              className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
            />
          </Field>

          <Field label="Description">
            <input
              name="description"
              className="w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
              placeholder="Summarises yesterday's sales from the CRM."
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

          <Field label="Input schema (JSON Schema)">
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

          <Field label="Output schema (JSON Schema)">
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
              <NumField label="max_tokens_per_run" name="max_tokens_per_run" defaultValue={40000} />
            </div>
          </section>
        </aside>

        <div className="md:col-span-3 flex items-center justify-end gap-2">
          <Link
            href="/agents"
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
          >
            Create agent
          </button>
        </div>
      </form>
    </PageFrame>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-500">{hint}</span>}
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
