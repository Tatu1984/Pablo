import { query } from "@/backend/database/client";

export interface ApiKeyRow {
  id: string;
  org_id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const COLS = `id, org_id, name, prefix,
  to_char(created_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at,
  to_char(revoked_at,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS revoked_at`;

export async function listApiKeys(orgId: string): Promise<ApiKeyRow[]> {
  return query<ApiKeyRow>(
    `SELECT ${COLS} FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId],
  );
}

export async function insertApiKey(
  id: string,
  orgId: string,
  name: string,
  prefix: string,
  hash: string,
  createdBy: string | null,
): Promise<ApiKeyRow> {
  const rows = await query<ApiKeyRow>(
    `INSERT INTO api_keys (id, org_id, name, prefix, hash, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLS}`,
    [id, orgId, name, prefix, hash, createdBy],
  );
  return rows[0];
}

export async function revokeApiKey(orgId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE api_keys SET revoked_at = now()
      WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
      RETURNING id`,
    [id, orgId],
  );
  return rows.length > 0;
}

// Authorization-header lookup. Returns the api_keys row + org_id (no
// columns we can't safely log). Callers should call markApiKeyUsed
// asynchronously to bump last_used_at.
export interface ResolvedApiKey {
  id: string;
  org_id: string;
  name: string;
}

export async function findApiKeyByHash(hash: string): Promise<ResolvedApiKey | null> {
  const rows = await query<ResolvedApiKey>(
    `SELECT id, org_id, name FROM api_keys
      WHERE hash = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [hash],
  );
  return rows[0] ?? null;
}

export async function markApiKeyUsed(id: string): Promise<void> {
  await query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [id]);
}
