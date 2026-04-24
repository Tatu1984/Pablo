import { query } from "@/backend/database/client";
import type { Provider } from "@/shared/types/provider.types";

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
