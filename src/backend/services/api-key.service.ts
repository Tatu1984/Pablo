import { createHash, randomBytes } from "node:crypto";
import {
  findApiKeyByHash,
  insertApiKey,
  listApiKeys,
  markApiKeyUsed,
  revokeApiKey,
  type ApiKeyRow,
  type ResolvedApiKey,
} from "@/backend/repositories/apiKey.repository";
import { newId } from "@/backend/utils/id.util";

const PREFIX = "sk_live_";

export class ApiKeyError extends Error {
  constructor(
    public code: "not_found" | "already_revoked" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

function hashKey(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export interface IssuedApiKey {
  row: ApiKeyRow;
  plaintext: string; // shown exactly once
}

export async function issueApiKey(
  orgId: string,
  name: string,
  createdBy: string | null,
): Promise<IssuedApiKey> {
  const id = newId("key");
  const random = randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${random}`;
  const prefix = plaintext.slice(0, 12); // "sk_live_xxxx"
  const hash = hashKey(plaintext);
  const row = await insertApiKey(id, orgId, name, prefix, hash, createdBy);
  return { row, plaintext };
}

export async function listKeys(orgId: string) {
  return listApiKeys(orgId);
}

export async function revokeKey(orgId: string, id: string) {
  const ok = await revokeApiKey(orgId, id);
  if (!ok) throw new ApiKeyError("not_found", "Key not found or already revoked.");
}

// Resolve a bearer token. Returns null if invalid / revoked. Updates
// last_used_at fire-and-forget so the auth path stays fast.
export async function verifyApiKey(plain: string): Promise<ResolvedApiKey | null> {
  if (!plain || !plain.startsWith(PREFIX)) return null;
  const hash = hashKey(plain);
  const row = await findApiKeyByHash(hash);
  if (!row) return null;
  void markApiKeyUsed(row.id).catch(() => {});
  return row;
}
