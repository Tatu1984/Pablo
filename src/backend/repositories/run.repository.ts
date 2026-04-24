import { query } from "@/backend/database/client";
import type { Run, TraceStep } from "@/shared/types/run.types";

export async function getRunsForAgent(orgId: string, agentId: string): Promise<Run[]> {
  return query<Run>(
    `SELECT id, agent_id, status, reason_code,
            tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
            to_char(queued_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS queued_at,
            to_char(started_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
            to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at
       FROM runs
      WHERE org_id = $1 AND agent_id = $2
      ORDER BY queued_at DESC`,
    [orgId, agentId],
  );
}

export async function getRun(orgId: string, runId: string): Promise<Run | null> {
  const rows = await query<Run>(
    `SELECT id, agent_id, status, reason_code,
            tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
            to_char(queued_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS queued_at,
            to_char(started_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
            to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at
       FROM runs
      WHERE id = $1 AND org_id = $2`,
    [runId, orgId],
  );
  return rows[0] ?? null;
}

export async function getTrace(orgId: string, runId: string): Promise<TraceStep[]> {
  const rows = await query<{
    seq: number;
    ts: string;
    type: TraceStep["type"];
    summary: string;
    payload: unknown | null;
  }>(
    `SELECT e.seq,
            to_char(e.ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ts,
            e.type, e.summary, e.payload
       FROM run_events e
       JOIN runs r ON r.id = e.run_id
      WHERE e.run_id = $1 AND r.org_id = $2
      ORDER BY e.seq ASC`,
    [runId, orgId],
  );
  return rows.map((r) => ({
    seq: r.seq,
    ts: r.ts,
    type: r.type,
    summary: r.summary,
    detail: r.payload ?? undefined,
  }));
}
