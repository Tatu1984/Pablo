import { query } from "@/backend/database/client";
import type { Agent } from "@/shared/types/agent.types";

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
