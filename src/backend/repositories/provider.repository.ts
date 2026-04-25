import { query } from "@/backend/database/client";
import type { Provider, ProviderType } from "@/shared/types/provider.types";

export async function getProviders(orgId: string): Promise<Provider[]> {
  return query<Provider>(
    `SELECT id, name, type, base_url, key_prefix, models, status, byo,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at
       FROM providers
      WHERE org_id = $1
      ORDER BY created_at ASC`,
    [orgId],
  );
}

// Server-only read that returns the encrypted key too. Never return this from
// an HTTP handler — the gateway/service is the only legitimate caller.
export async function getProviderEncrypted(
  orgId: string,
  id: string,
): Promise<(Provider & { encrypted_key: string | null }) | null> {
  const rows = await query<Provider & { encrypted_key: string | null }>(
    `SELECT id, name, type, base_url, key_prefix, encrypted_key, models, status, byo,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at
       FROM providers
      WHERE id = $1 AND org_id = $2`,
    [id, orgId],
  );
  return rows[0] ?? null;
}

export async function getProvider(orgId: string, id: string): Promise<Provider | null> {
  const rows = await query<Provider>(
    `SELECT id, name, type, base_url, key_prefix, models, status, byo,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at
       FROM providers
      WHERE id = $1 AND org_id = $2`,
    [id, orgId],
  );
  return rows[0] ?? null;
}

export interface InsertProviderInput {
  id: string;
  orgId: string;
  name: string;
  type: ProviderType;
  baseUrl: string | null;
  keyPrefix: string | null;
  encryptedKey: string | null;
  models: string[];
  byo: boolean;
}

export async function insertProvider(i: InsertProviderInput): Promise<Provider> {
  const rows = await query<Provider>(
    `INSERT INTO providers
       (id, org_id, name, type, base_url, key_prefix, encrypted_key, models, status, byo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',$9)
     RETURNING id, name, type, base_url, key_prefix, models, status, byo,
               to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
               to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at`,
    [
      i.id,
      i.orgId,
      i.name,
      i.type,
      i.baseUrl,
      i.keyPrefix,
      i.encryptedKey,
      JSON.stringify(i.models),
      i.byo,
    ],
  );
  return rows[0];
}

export interface UpdateProviderInput {
  name?: string;
  baseUrl?: string | null;
  keyPrefix?: string | null;
  encryptedKey?: string;
  models?: string[];
  status?: Provider["status"];
}

export async function updateProvider(
  orgId: string,
  id: string,
  patch: UpdateProviderInput,
): Promise<Provider | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const add = (col: string, value: unknown, cast = "") => {
    sets.push(`${col} = $${i++}${cast}`);
    params.push(value);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.baseUrl !== undefined) add("base_url", patch.baseUrl);
  if (patch.keyPrefix !== undefined) add("key_prefix", patch.keyPrefix);
  if (patch.encryptedKey !== undefined) add("encrypted_key", patch.encryptedKey);
  if (patch.models !== undefined) add("models", JSON.stringify(patch.models), "::jsonb");
  if (patch.status !== undefined) add("status", patch.status);

  if (sets.length === 0) return getProvider(orgId, id);

  params.push(id, orgId);
  const rows = await query<Provider>(
    `UPDATE providers
        SET ${sets.join(", ")}
      WHERE id = $${i++} AND org_id = $${i++}
      RETURNING id, name, type, base_url, key_prefix, models, status, byo,
                to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
                to_char(last_used_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function countAgentsUsingProvider(
  orgId: string,
  providerId: string,
): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM agents
      WHERE org_id = $1 AND provider_id = $2 AND archived_at IS NULL`,
    [orgId, providerId],
  );
  return Number(rows[0]?.n ?? "0");
}

export async function touchProvider(providerId: string): Promise<void> {
  await query(`UPDATE providers SET last_used_at = now() WHERE id = $1`, [providerId]);
}
