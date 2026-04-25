import { query } from "@/backend/database/client";
import type { Run, RunStatus, TraceStep } from "@/shared/types/run.types";

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

// ─── writes ──────────────────────────────────────────────────────────────────

export async function insertRun(
  id: string,
  orgId: string,
  agentId: string,
  input: unknown,
): Promise<Run> {
  const rows = await query<Run>(
    `INSERT INTO runs (id, org_id, agent_id, status, input, started_at)
     VALUES ($1, $2, $3, 'running', $4::jsonb, now())
     RETURNING id, agent_id, status, reason_code,
               tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
               to_char(queued_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS queued_at,
               to_char(started_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
               to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at`,
    [id, orgId, agentId, JSON.stringify(input)],
  );
  return rows[0];
}

export interface UpdateRunInput {
  status: RunStatus;
  reasonCode?: string | null;
  output?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  stepCount?: number;
  toolCallCount?: number;
  finished?: boolean;
}

export async function updateRun(id: string, patch: UpdateRunInput): Promise<void> {
  await query(
    `UPDATE runs
        SET status          = $2,
            reason_code     = COALESCE($3, reason_code),
            output          = COALESCE($4::jsonb, output),
            tokens_in       = COALESCE($5, tokens_in),
            tokens_out      = COALESCE($6, tokens_out),
            step_count      = COALESCE($7, step_count),
            tool_call_count = COALESCE($8, tool_call_count),
            finished_at     = CASE WHEN $9 THEN now() ELSE finished_at END
      WHERE id = $1`,
    [
      id,
      patch.status,
      patch.reasonCode ?? null,
      patch.output === undefined ? null : JSON.stringify(patch.output),
      patch.tokensIn ?? null,
      patch.tokensOut ?? null,
      patch.stepCount ?? null,
      patch.toolCallCount ?? null,
      patch.finished ?? false,
    ],
  );
}

export async function insertRunEvent(
  runId: string,
  seq: number,
  type: TraceStep["type"],
  summary: string,
  payload: unknown,
): Promise<void> {
  await query(
    `INSERT INTO run_events (run_id, seq, ts, type, summary, payload)
     VALUES ($1, $2, now(), $3, $4, $5::jsonb)
     ON CONFLICT (run_id, seq) DO NOTHING`,
    [runId, seq, type, summary, payload === null ? null : JSON.stringify(payload)],
  );
}
