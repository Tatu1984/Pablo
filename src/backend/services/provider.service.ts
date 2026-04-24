import { PROVIDER_TYPES } from "@/shared/constants/providers";
import { newId } from "@/backend/utils/id.util";
import { encryptSecret, decryptSecret, keyPrefix } from "@/backend/utils/crypto.util";
import { transaction } from "@/backend/database/client";
import {
  countAgentsUsingProvider,
  getProvider,
  insertProvider,
  updateProvider as updateProviderRow,
} from "@/backend/repositories/provider.repository";
import type {
  CreateProviderInput,
  UpdateProviderInput,
} from "@/backend/validators/provider.validator";
import type { Provider } from "@/shared/types/provider.types";

export class ProviderError extends Error {
  constructor(
    public code: "not_found" | "in_use" | "missing_key",
    message: string,
  ) {
    super(message);
  }
}

function defaultBaseUrl(type: CreateProviderInput["type"]): string | null {
  const meta = PROVIDER_TYPES.find((p) => p.type === type);
  return meta?.default_base_url ?? null;
}

export async function createProvider(
  orgId: string,
  input: CreateProviderInput,
): Promise<Provider> {
  const baseUrl = input.base_url ?? defaultBaseUrl(input.type);

  let encryptedKey: string | null = null;
  let prefix: string | null = null;
  if (input.api_key) {
    encryptedKey = encryptSecret(input.api_key);
    prefix = keyPrefix(input.api_key);
  }

  return insertProvider({
    id: newId("prov"),
    orgId,
    name: input.name,
    type: input.type,
    baseUrl,
    keyPrefix: prefix,
    encryptedKey,
    models: input.models,
    byo: true,
  });
}

export async function updateProvider(
  orgId: string,
  id: string,
  input: UpdateProviderInput,
): Promise<Provider> {
  const existing = await getProvider(orgId, id);
  if (!existing) throw new ProviderError("not_found", "Provider not found.");

  let encryptedKey: string | undefined;
  let prefix: string | undefined;
  if (input.api_key) {
    encryptedKey = encryptSecret(input.api_key);
    prefix = keyPrefix(input.api_key);
  }

  const updated = await updateProviderRow(orgId, id, {
    name: input.name,
    baseUrl: input.base_url,
    encryptedKey,
    keyPrefix: prefix,
    models: input.models,
    status: input.status,
  });
  if (!updated) throw new ProviderError("not_found", "Provider not found.");
  return updated;
}

export async function deleteProvider(orgId: string, id: string): Promise<void> {
  const provider = await getProvider(orgId, id);
  if (!provider) throw new ProviderError("not_found", "Provider not found.");

  const n = await countAgentsUsingProvider(orgId, id);
  if (n > 0) {
    throw new ProviderError(
      "in_use",
      `Provider is in use by ${n} agent${n === 1 ? "" : "s"}. Reassign or archive them first.`,
    );
  }

  // Archived agents may still reference this provider (FK is RESTRICT). Null
  // those references out atomically with the delete — they're soft-deleted
  // and not runnable anyway.
  await transaction(async (client) => {
    await client.query(
      `UPDATE agents SET provider_id = NULL
        WHERE org_id = $1 AND provider_id = $2 AND archived_at IS NOT NULL`,
      [orgId, id],
    );
    const res = await client.query(
      `DELETE FROM providers WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, orgId],
    );
    if (res.rowCount === 0) {
      throw new ProviderError("not_found", "Provider not found.");
    }
  });
}

// ─── Test connection ─────────────────────────────────────────────────────────

export interface ProviderTestResult {
  ok: boolean;
  status: number | null;
  models?: string[];
  message: string;
}

// Probes the OpenAI-style /models endpoint. Works for OpenRouter, OpenAI,
// OpenAI-compatible (Together/Groq/Fireworks/vLLM), and Ollama. For the
// remaining provider types we return a neutral "verify manually" result.
export async function testProvider(
  orgId: string,
  id: string,
): Promise<ProviderTestResult> {
  const provider = await getProvider(orgId, id);
  if (!provider) throw new ProviderError("not_found", "Provider not found.");

  const SUPPORTED: Provider["type"][] = [
    "openrouter",
    "openai",
    "openai_compatible",
    "ollama",
  ];
  if (!SUPPORTED.includes(provider.type)) {
    return {
      ok: true,
      status: null,
      message:
        "Automatic probing isn't supported for this provider type yet — save the key and try an agent run when ready.",
    };
  }

  const base = provider.base_url;
  if (!base) return { ok: false, status: null, message: "No base URL configured." };

  const url = base.replace(/\/$/, "") + "/models";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (provider.type !== "ollama") {
    const encrypted = await getEncryptedKey(orgId, id);
    if (!encrypted) throw new ProviderError("missing_key", "No API key on file for this provider.");
    headers.Authorization = `Bearer ${decryptSecret(encrypted)}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: `Provider responded ${res.status}: ${text.slice(0, 160)}`,
      };
    }
    const body = (await res.json()) as unknown;
    const models = extractModelList(body).slice(0, 200);
    return {
      ok: true,
      status: res.status,
      models,
      message: `Probe succeeded — found ${models.length} models.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, status: null, message: `Could not reach ${url}: ${detail}` };
  }
}

async function getEncryptedKey(orgId: string, id: string): Promise<string | null> {
  // Read the encrypted_key column directly; getProvider deliberately excludes it.
  const rows = await (
    await import("@/backend/database/client")
  ).query<{ encrypted_key: string | null }>(
    `SELECT encrypted_key FROM providers WHERE id = $1 AND org_id = $2`,
    [id, orgId],
  );
  return rows[0]?.encrypted_key ?? null;
}

function extractModelList(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const data = Array.isArray(obj.data)
    ? obj.data
    : Array.isArray(obj.models)
      ? obj.models
      : Array.isArray(obj.result)
        ? obj.result
        : [];
  const out: string[] = [];
  for (const item of data as unknown[]) {
    if (typeof item === "string") out.push(item);
    else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const id = rec.id ?? rec.name ?? rec.model;
      if (typeof id === "string") out.push(id);
    }
  }
  return out;
}
