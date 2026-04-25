import { query } from "@/backend/database/client";

export interface MemoryEntry {
  agent_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export async function readMemory(agentId: string, key: string): Promise<unknown | null> {
  const rows = await query<{ value: unknown }>(
    `SELECT value FROM agent_memory WHERE agent_id = $1 AND key = $2`,
    [agentId, key],
  );
  return rows[0]?.value ?? null;
}

export async function writeMemory(
  agentId: string,
  key: string,
  value: unknown,
): Promise<MemoryEntry> {
  const rows = await query<MemoryEntry>(
    `INSERT INTO agent_memory (agent_id, key, value, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (agent_id, key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now()
     RETURNING agent_id, key, value,
               to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
    [agentId, key, JSON.stringify(value)],
  );
  return rows[0];
}

export async function deleteMemory(agentId: string, key: string): Promise<boolean> {
  const rows = await query<{ key: string }>(
    `DELETE FROM agent_memory WHERE agent_id = $1 AND key = $2 RETURNING key`,
    [agentId, key],
  );
  return rows.length > 0;
}

export async function listMemoryKeys(agentId: string): Promise<string[]> {
  const rows = await query<{ key: string }>(
    `SELECT key FROM agent_memory WHERE agent_id = $1 ORDER BY key`,
    [agentId],
  );
  return rows.map((r) => r.key);
}
