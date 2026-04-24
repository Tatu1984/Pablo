import { query } from "@/backend/database/client";
import type { Agent } from "@/shared/types/agent.types";

export async function getAgents(orgId: string): Promise<Agent[]> {
  return query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE org_id = $1 AND archived_at IS NULL
      ORDER BY created_at ASC`,
    [orgId],
  );
}

export async function getAgent(orgId: string, id: string): Promise<Agent | null> {
  const rows = await query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE id = $1 AND org_id = $2 AND archived_at IS NULL`,
    [id, orgId],
  );
  return rows[0] ?? null;
}
