import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import RunsTable from "@/frontend/components/features/runs/RunsTable";
import StatusFilter from "@/frontend/components/features/runs/StatusFilter";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getRunsForOrg } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";
import type { RunStatus } from "@/shared/types/run.types";

const VALID_STATUS: RunStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
];

export default async function AgentRunsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { status?: string };
}) {
  const { org } = await requireSession();
  const agent = await getAgent(org.id, params.id);
  if (!agent) notFound();

  const status = VALID_STATUS.find((s) => s === searchParams?.status);
  const rows = await getRunsForOrg(org.id, { agentId: agent.id, status, limit: 100 });

  return (
    <PageFrame>
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${agent.id}`, label: agent.name },
          { label: "Runs" },
        ]}
        title={`${agent.name} — runs`}
        description="Every execution of this agent. Click in for the full append-only trace."
      />
      <StatusFilter basePath={`/agents/${agent.id}/runs`} current={status} />
      <RunsTable rows={rows} showAgent={false} />
    </PageFrame>
  );
}
