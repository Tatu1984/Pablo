import Link from "next/link";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import ProviderBadge from "@/components/ProviderBadge";
import { fmtDate } from "@/lib/mock";
import { getProviders } from "@/lib/queries";

export default async function ProvidersPage() {
  const providers = await getProviders();
  return (
    <PageFrame>
      <PageHeader
        title="LLM providers"
        description="Connect as many providers as you need — our default OpenRouter gateway, your own API keys, or a self-hosted endpoint. Agents pick a model from any active provider."
        actions={
          <Link
            href="/providers/new"
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
          >
            Add provider
          </Link>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Base URL</th>
              <th className="px-4 py-2.5 font-medium">Models</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Last used</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 bg-ink-950">
            {providers.map((p) => (
              <tr key={p.id} className="align-top hover:bg-ink-900/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-100">{p.name}</span>
                    {p.byo && (
                      <span className="rounded border border-ink-800 bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                        BYO
                      </span>
                    )}
                  </div>
                  <div className="mono text-[11px] text-ink-500">{p.id}</div>
                </td>
                <td className="px-4 py-3">
                  <ProviderBadge type={p.type} />
                </td>
                <td className="mono px-4 py-3 text-xs text-ink-400">
                  {p.base_url ?? <span className="text-ink-500">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-ink-300">
                  <div className="flex flex-wrap gap-1">
                    {p.models.slice(0, 3).map((m) => (
                      <span key={m} className="mono rounded bg-ink-900 px-1.5 py-0.5 text-[11px]">
                        {m}
                      </span>
                    ))}
                    {p.models.length > 3 && (
                      <span className="text-[11px] text-ink-500">
                        +{p.models.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${
                      p.status === "active"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        : p.status === "error"
                          ? "border-red-500/30 bg-red-500/10 text-red-500"
                          : "border-ink-500/30 bg-ink-500/10 text-ink-400"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-ink-400">{fmtDate(p.last_used_at)}</td>
                <td className="px-4 py-3 text-right text-xs">
                  <Link href={`/providers/${p.id}`} className="mr-3 text-ink-300 hover:text-ink-100">
                    Edit
                  </Link>
                  {p.byo && (
                    <button className="text-red-500 hover:text-red-400">Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-ink-500">
        API keys and endpoints are encrypted at rest and only decrypted inside the execution
        sandbox per run. We normalise request and response shapes through the{" "}
        <span className="text-ink-300">LLM Gateway</span> so quota, retry, and cost metering work
        the same across every provider.
      </p>
    </PageFrame>
  );
}
