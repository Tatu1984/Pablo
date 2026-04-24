"use client";

import Link from "next/link";
import { useState } from "react";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import { PROVIDER_TYPES } from "@/shared/constants/providers";
import type { ProviderType } from "@/shared/types/provider.types";

export default function NewProviderPage() {
  const [type, setType] = useState<ProviderType>("openrouter");
  const current = PROVIDER_TYPES.find((p) => p.type === type)!;

  return (
    <PageFrame>
      <PageHeader
        crumbs={[{ href: "/providers", label: "Providers" }, { label: "New" }]}
        title="Add an LLM provider"
        description="Pick a provider type, paste credentials, and we'll discover available models. You can enable more than one per provider."
      />

      <form className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2 flex flex-col gap-5 rounded-lg border border-ink-800 bg-ink-950 p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink-100">Provider</h2>
            <p className="mt-1 text-xs text-ink-500">
              Managed providers are vetted for cost/egress rules. OpenAI-compatible + Ollama let
              you plug in anything with a compatible chat-completions shape.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDER_TYPES.map((p) => (
                <label
                  key={p.type}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                    type === p.type
                      ? "border-accent-600/50 bg-accent-600/5"
                      : "border-ink-800 hover:border-ink-700 hover:bg-ink-900"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={p.type}
                    checked={type === p.type}
                    onChange={() => setType(p.type)}
                    className="mt-0.5 h-3.5 w-3.5 accent-accent-600"
                  />
                  <div>
                    <div className="font-medium text-ink-100">{p.label}</div>
                    <div className="text-[11px] text-ink-500">{p.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-800 pt-5">
            <h2 className="text-sm font-semibold text-ink-100">Connection</h2>
            <div className="mt-3 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-300">Display name</span>
                <input
                  placeholder={`${current.label} — production`}
                  className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
                />
              </label>

              {(type === "openai_compatible" || type === "ollama") && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-ink-300">Base URL</span>
                  <input
                    placeholder={
                      current.default_base_url ?? "https://api.example.com/v1"
                    }
                    defaultValue={current.default_base_url}
                    className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                  />
                  <span className="text-[11px] text-ink-500">
                    OpenAI-style <span className="mono">/chat/completions</span> endpoint.
                  </span>
                </label>
              )}

              {type !== "ollama" && type !== "bedrock" && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-ink-300">{current.key_label ?? "API key"}</span>
                  <input
                    type="password"
                    placeholder="sk-…"
                    className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                  />
                  <span className="text-[11px] text-ink-500">
                    Stored encrypted. Decrypted only inside the execution sandbox at run time.
                  </span>
                </label>
              )}

              {type === "bedrock" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-300">Region</span>
                    <input
                      placeholder="us-east-1"
                      className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-300">Role ARN (cross-account)</span>
                    <input
                      placeholder="arn:aws:iam::123456789012:role/PabloBedrock"
                      className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="text-ink-300">Access key ID (optional)</span>
                    <input
                      placeholder="AKIA…"
                      className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                    />
                    <span className="text-[11px] text-ink-500">
                      Leave blank to use the cross-account role's trust policy.
                    </span>
                  </label>
                </div>
              )}

              {current.extra_fields
                ?.filter((f) => {
                  // Base URL already rendered above for openai_compatible/ollama
                  if (type === "openai_compatible" && f.name === "base_url") return false;
                  return true;
                })
                .map((f) => (
                  <label key={f.name} className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-300">{f.label}</span>
                    <input
                      placeholder={f.placeholder}
                      className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
                    />
                  </label>
                ))}
            </div>
          </div>

          <div className="border-t border-ink-800 pt-5">
            <h2 className="text-sm font-semibold text-ink-100">Models</h2>
            <p className="mt-1 text-xs text-ink-500">
              After you save we probe the endpoint for its model list. You can also paste a
              comma-separated allowlist here.
            </p>
            <textarea
              rows={3}
              placeholder="gpt-4o, gpt-4o-mini, o3-mini"
              className="mono mt-3 w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink-800 pt-5">
            <Link
              href="/providers"
              className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-900"
            >
              Cancel
            </Link>
            <button
              type="button"
              className="rounded-md border border-ink-800 bg-ink-900 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800"
            >
              Test connection
            </button>
            <button
              type="submit"
              className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
            >
              Add provider
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-ink-800 bg-ink-950 p-5">
            <h3 className="text-sm font-semibold text-ink-100">How it's used</h3>
            <ol className="mt-3 flex flex-col gap-3 text-xs text-ink-400">
              <li>
                <span className="mono text-ink-200">1.</span> The LLM Gateway wraps every provider
                behind one request/response shape.
              </li>
              <li>
                <span className="mono text-ink-200">2.</span> Retry, fallback, and rate-limit rules
                stay consistent — even for BYO endpoints.
              </li>
              <li>
                <span className="mono text-ink-200">3.</span> Token usage is recorded against your
                quota as soon as the provider reports it.
              </li>
            </ol>
          </section>

          <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
            <h3 className="text-sm font-semibold text-amber-500">Before you connect</h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-xs text-ink-300">
              <li>Use a scoped key — we don't need org-wide permissions.</li>
              <li>
                If the provider lives on a private network, make sure the worker nodes can reach
                it (allowlist our egress ranges).
              </li>
              <li>
                Rotate keys regularly; you can revoke a provider without rewriting agents — they
                stay pinned to the provider ID, not the key.
              </li>
            </ul>
          </section>
        </aside>
      </form>
    </PageFrame>
  );
}
