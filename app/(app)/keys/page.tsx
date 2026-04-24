import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { fmtDate } from "@/lib/mock";

const KEYS = [
  {
    id: "key_01HS77ZZB01",
    name: "production",
    prefix: "sk_live_8fRx",
    created_at: "2026-02-03T12:10:00Z",
    last_used_at: "2026-04-23T09:55:12Z",
    revoked_at: null,
  },
  {
    id: "key_01HS77ZZB02",
    name: "staging",
    prefix: "sk_live_1m2W",
    created_at: "2026-03-14T08:05:00Z",
    last_used_at: "2026-04-22T18:20:03Z",
    revoked_at: null,
  },
  {
    id: "key_01HS77ZZB03",
    name: "intern-sandbox",
    prefix: "sk_live_0p0p",
    created_at: "2026-03-27T16:30:00Z",
    last_used_at: null,
    revoked_at: "2026-04-15T10:00:00Z",
  },
];

export default function KeysPage() {
  return (
    <PageFrame>
      <PageHeader
        title="API keys"
        description="API keys authenticate server-to-server calls to /v1. Plaintext is shown exactly once on creation."
        actions={
          <button className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700">
            Issue key
          </button>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Prefix</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Last used</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 bg-ink-950">
            {KEYS.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3">
                  <div className="text-ink-100">{k.name}</div>
                  <div className="mono text-[11px] text-ink-500">{k.id}</div>
                </td>
                <td className="mono px-4 py-3 text-xs text-ink-300">{k.prefix}…</td>
                <td className="px-4 py-3 text-xs text-ink-400">{fmtDate(k.created_at)}</td>
                <td className="px-4 py-3 text-xs text-ink-400">{fmtDate(k.last_used_at)}</td>
                <td className="px-4 py-3 text-xs">
                  {k.revoked_at ? (
                    <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-400">
                      revoked
                    </span>
                  ) : (
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400">
                      active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {!k.revoked_at && (
                    <button className="text-red-400 hover:text-red-300">Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-xl text-xs text-ink-500">
        Secrets are stored as SHA-256 hashes. Plaintext cannot be recovered — rotate the key if it
        leaks.
      </p>
    </PageFrame>
  );
}
