import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import RunsTable from "@/frontend/components/features/runs/RunsTable";
import StatusFilter from "@/frontend/components/features/runs/StatusFilter";
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

export default async function RunsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { org } = await requireSession();
  const status = VALID_STATUS.find((s) => s === searchParams?.status);
  const rows = await getRunsForOrg(org.id, { status, limit: 100 });

  return (
    <PageFrame>
      <PageHeader
        title="Runs"
        description="Every execution across your org. Click in to see step-by-step trace and copy any payload."
      />
      <StatusFilter basePath="/runs" current={status} />
      <RunsTable rows={rows} />
    </PageFrame>
  );
}
