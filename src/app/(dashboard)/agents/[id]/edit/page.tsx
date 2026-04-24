import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import EditAgentConfigForm from "@/frontend/components/features/agents/EditAgentConfigForm";
import PromptEditor from "@/frontend/components/features/agents/PromptEditor";
import ArchiveAgentButton from "@/frontend/components/features/agents/ArchiveAgentButton";
import { getAgent, listPromptVersions } from "@/backend/repositories/agent.repository";
import { getProviders } from "@/backend/repositories/provider.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function EditAgentPage({ params }: { params: { id: string } }) {
  const { org } = await requireSession();
  const [agent, providers, versions] = await Promise.all([
    getAgent(org.id, params.id),
    getProviders(org.id),
    listPromptVersions(org.id, params.id),
  ]);
  if (!agent) notFound();

  const latest = versions.find((v) => v.version === agent.current_prompt_version);

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
          <EditAgentConfigForm agent={agent} providers={providers} />
          <PromptEditor
            agentId={agent.id}
            currentVersion={agent.current_prompt_version}
            versions={versions.map((v) => ({
              id: v.id,
              version: v.version,
              note: v.note,
              created_at: v.created_at,
            }))}
            initial={{
              system_prompt: latest?.system_prompt ?? "",
              task_prompt: latest?.task_prompt ?? "",
              tool_instructions: latest?.tool_instructions ?? "",
            }}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-red-800/50 bg-red-950/30 p-5">
            <h3 className="text-sm font-semibold text-red-300">Danger zone</h3>
            <p className="mt-1 text-xs text-red-300/80">
              Archiving soft-deletes the agent. Runs and traces are retained.
            </p>
            <div className="mt-3">
              <ArchiveAgentButton agentId={agent.id} />
            </div>
          </section>
        </aside>
      </div>
    </PageFrame>
  );
}
