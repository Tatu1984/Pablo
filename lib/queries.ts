import { query } from "./db";
import type {
  Agent,
  Provider,
  Run,
  TraceStep,
} from "./types";

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
  return query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE archived_at IS NULL
      ORDER BY created_at ASC`,
  );
}

export async function getAgent(id: string): Promise<Agent | null> {
  const rows = await query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE id = $1 AND archived_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

// ─── Providers ───────────────────────────────────────────────────────────────

export async function getProviders(): Promise<Provider[]> {
  return query<Provider>(
    `SELECT id, name, type, base_url, key_prefix, models, status, byo,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at
       FROM providers
      ORDER BY created_at ASC`,
  );
}

export async function getProvider(id: string): Promise<Provider | null> {
  const rows = await query<Provider>(
    `SELECT id, name, type, base_url, key_prefix, models, status, byo,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at
       FROM providers
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─── Runs ────────────────────────────────────────────────────────────────────

export async function getRunsForAgent(agentId: string): Promise<Run[]> {
  return query<Run>(
    `SELECT id, agent_id, status, reason_code,
            tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
            to_char(queued_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS queued_at,
            to_char(started_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
            to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at
       FROM runs
      WHERE agent_id = $1
      ORDER BY queued_at DESC`,
    [agentId],
  );
}

export async function getRun(runId: string): Promise<Run | null> {
  const rows = await query<Run>(
    `SELECT id, agent_id, status, reason_code,
            tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
            to_char(queued_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS queued_at,
            to_char(started_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
            to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at
       FROM runs
      WHERE id = $1`,
    [runId],
  );
  return rows[0] ?? null;
}

export async function getTrace(runId: string): Promise<TraceStep[]> {
  const rows = await query<{
    seq: number;
    ts: string;
    type: TraceStep["type"];
    summary: string;
    payload: unknown | null;
  }>(
    `SELECT seq,
            to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ts,
            type, summary, payload
       FROM run_events
      WHERE run_id = $1
      ORDER BY seq ASC`,
    [runId],
  );
  return rows.map((r) => ({
    seq: r.seq,
    ts: r.ts,
    type: r.type,
    summary: r.summary,
    detail: r.payload ?? undefined,
  }));
}
