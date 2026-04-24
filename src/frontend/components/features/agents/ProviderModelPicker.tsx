"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Provider } from "@/shared/types";

export default function ProviderModelPicker({
  providers,
  providerId,
  model,
}: {
  providers: Provider[];
  providerId?: string;
  model?: string;
}) {
  const active = providers.filter((p) => p.status === "active");
  const initialProvider: Provider | undefined =
    active.find((p) => p.id === providerId) ?? active[0];
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    initialProvider?.id ?? "",
  );
  const selectedProvider = useMemo(
    () => active.find((p) => p.id === selectedProviderId),
    [active, selectedProviderId],
  );

  const initialModel =
    selectedProvider && selectedProvider.models.includes(model ?? "")
      ? model!
      : selectedProvider?.models[0] ?? "";
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Provider</span>
        <select
          name="provider_id"
          value={selectedProviderId}
          onChange={(e) => {
            const p = active.find((x) => x.id === e.target.value);
            setSelectedProviderId(e.target.value);
            if (p) setSelectedModel(p.models[0] ?? "");
          }}
          className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent-600"
        >
          {active.length === 0 && <option value="">No providers configured</option>}
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-500">
          Need another one?{" "}
          <Link href="/providers/new" className="text-accent-600 hover:underline">
            Add a provider
          </Link>
          .
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Model</span>
        <select
          name="model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
        >
          {(selectedProvider?.models ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {(!selectedProvider || selectedProvider.models.length === 0) && (
            <option value="">No models yet — edit provider first</option>
          )}
        </select>
        <span className="text-[11px] text-ink-500">
          Pinned per run. Changing here does not affect in-flight executions.
        </span>
      </label>
    </div>
  );
}
