"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Provider } from "@/shared/types/provider.types";

interface ProblemJson {
  detail?: string;
  errors?: Record<string, string[]>;
}

export default function EditProviderForm({ provider }: { provider: Provider }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const modelsText = String(form.get("models") ?? "");
    const models = modelsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const apiKeyRaw = String(form.get("api_key") ?? "").trim();
    const baseUrlRaw = String(form.get("base_url") ?? "").trim();

    const payload: Record<string, unknown> = {
      name: String(form.get("name") ?? "").trim(),
      models,
      status: String(form.get("status") ?? "active"),
    };
    if (apiKeyRaw) payload.api_key = apiKeyRaw;
    if (baseUrlRaw) payload.base_url = baseUrlRaw;

    try {
      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOk(apiKeyRaw ? "Provider updated. API key rotated." : "Provider updated.");
        router.refresh();
        return;
      }
      const problem: ProblemJson = await res.json().catch(() => ({}));
      if (problem.errors) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(problem.errors)) flat[k] = v[0] ?? "";
        setFieldErrors(flat);
      }
      setError(problem.detail ?? "Could not update provider.");
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  const allowsBaseUrl =
    provider.type === "openai_compatible" || provider.type === "ollama";

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-lg border border-ink-800 bg-ink-950 p-5"
      noValidate
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Display name</span>
        <input
          name="name"
          required
          defaultValue={provider.name}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        />
        {fieldErrors.name && <span className="text-[11px] text-red-400">{fieldErrors.name}</span>}
      </label>

      {allowsBaseUrl && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Base URL</span>
          <input
            name="base_url"
            defaultValue={provider.base_url ?? ""}
            className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
          />
          {fieldErrors.base_url && (
            <span className="text-[11px] text-red-400">{fieldErrors.base_url}</span>
          )}
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Rotate API key</span>
        <input
          name="api_key"
          type="password"
          placeholder={
            provider.key_prefix
              ? `Current key starts with ${provider.key_prefix}… — leave blank to keep`
              : "No key on file — paste one to enable this provider"
          }
          className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
        />
        <span className="text-[11px] text-ink-500">
          Stored encrypted with AES-256-GCM. Decrypted only inside the execution sandbox at run
          time.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Models</span>
        <textarea
          name="models"
          rows={4}
          defaultValue={provider.models.join("\n")}
          className="mono w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
        />
        <span className="text-[11px] text-ink-500">
          One per line, or comma-separated. Agents pick from this list.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Status</span>
        <select
          name="status"
          defaultValue={provider.status === "error" ? "active" : provider.status}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        >
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}
      {ok && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
        >
          {ok}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-ink-800 pt-5">
        <Link
          href="/providers"
          className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
