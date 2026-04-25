import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import RunDetail from "@/frontend/components/features/runs/RunDetail";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getRun, getTrace } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function RunDetailPage({
  params,
}: {
  params: { id: string; run_id: string };
}) {
  const { org } = await requireSession();
  const [agent, run] = await Promise.all([
    getAgent(org.id, params.id),
    getRun(org.id, params.run_id),
  ]);
  if (!agent || !run) notFound();

  const trace = await getTrace(org.id, run.id);

  return (
    <PageFrame>
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${agent.id}`, label: agent.name },
          { href: `/agents/${agent.id}/runs`, label: "Runs" },
          { label: run.id },
        ]}
        title={<span className="mono">{run.id}</span>}
        description="Append-only step-by-step record. What was sent, what came back, and when."
      />
      <RunDetail agent={agent} initialRun={run} initialTrace={trace} />
    </PageFrame>
  );
}
