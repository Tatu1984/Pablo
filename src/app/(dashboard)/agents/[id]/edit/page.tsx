import Link from "next/link";
import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import ProviderModelPicker from "@/frontend/components/features/agents/ProviderModelPicker";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getProviders } from "@/backend/repositories/provider.repository";
import { requireSession } from "@/backend/services/session.service";

const PROMPT_VERSIONS = [
  { id: "prm_v4", version: "v4", created_at: "2026-04-10T08:12:00Z", note: "Tighter JSON coercion" },
  { id: "prm_v3", version: "v3", created_at: "2026-03-21T14:40:00Z", note: "Added retry guidance" },
  { id: "prm_v2", version: "v2", created_at: "2026-03-12T11:05:00Z", note: "Initial refinement" },
  { id: "prm_v1", version: "v1", created_at: "2026-03-01T09:12:00Z", note: "Created" },
];

const DEFAULT_SYSTEM = `You are a disciplined operational agent.
Follow the user's instructions to the letter.
Prefer structured output that matches the declared output_schema.
If a tool fails twice in a row, stop and return an error payload.`;

const DEFAULT_TASK = `Input: {{ input_json }}

Goal: produce a concise JSON object matching output_schema.
Use the declared tools only. Do not invent new ones.`;

export default async function EditAgentPage({ params }: { params: { id: string } }) {
  const { org } = await requireSession();
  const [agent, providers] = await Promise.all([
    getAgent(org.id, params.id),
    getProviders(org.id),
  ]);
  if (!agent) notFound();

  return (
    <PageFrame>
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${agent.id}`, label: agent.name },
          { label: "Edit" },
        ]}
        title={`Edit ${agent.name}`}
        description="Editing here does not mutate in-flight runs. A new prompt version pins itself to future runs only."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2 flex flex-col gap-6">
          <form className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h2 className="text-sm font-semibold text-ink-100">Configuration</h2>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Name</span>
              <input
                defaultValue={agent.name}
                className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Description</span>
              <input
                defaultValue={agent.description}
                className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Execution mode</span>
              <select
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/agents/${agent.id}`}
                className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
              >
                Cancel
              </Link>
              <button className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700">
                Save configuration
              </button>
            </div>
          </form>

          <form className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Prompt editor</h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  Saving publishes a new version. Old versions stay immutable for replay.
                </p>
              </div>
              <span className="mono text-[11px] text-ink-500">
                current: {agent.current_prompt_version}
              </span>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">System prompt</span>
              <textarea
                rows={6}
                defaultValue={DEFAULT_SYSTEM}
                className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Task prompt</span>
              <textarea
                rows={7}
                defaultValue={DEFAULT_TASK}
                className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Tool instructions</span>
              <textarea
                rows={4}
                defaultValue={`http.request: allow GET /orders and /customers only.
json.transform: prefer over writing free-form code.`}
                className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900">
                Save draft
              </button>
              <button className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700">
                Publish new version
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h3 className="text-sm font-semibold text-ink-100">Prompt versions</h3>
            <ul className="mt-3 flex flex-col divide-y divide-ink-800">
              {PROMPT_VERSIONS.map((p, i) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                  <div>
                    <div className="mono text-ink-100">{p.version}</div>
                    <div className="text-ink-500">{p.note}</div>
                  </div>
                  <div className="text-right text-[10px] text-ink-500">
                    <div>{new Date(p.created_at).toISOString().slice(0, 10)}</div>
                    {i === 0 && (
                      <div className="mt-1 inline-flex rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-400">
                        live
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-red-800/50 bg-red-950/30 p-5">
            <h3 className="text-sm font-semibold text-red-300">Danger zone</h3>
            <p className="mt-1 text-xs text-red-300/80">
              Archiving soft-deletes the agent. Runs and traces are retained.
            </p>
            <button className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20">
              Archive agent
            </button>
          </section>
        </aside>
      </div>
    </PageFrame>
  );
}
