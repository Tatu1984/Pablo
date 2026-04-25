import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import IssueKeyDialog from "@/frontend/components/features/keys/IssueKeyDialog";
import RevokeKeyButton from "@/frontend/components/features/keys/RevokeKeyButton";
import { fmtDate } from "@/frontend/utils/formatters";
import { listKeys } from "@/backend/services/api-key.service";
import { requireSession } from "@/backend/services/session.service";

export default async function KeysPage() {
  const { org } = await requireSession();
  const keys = await listKeys(org.id);

  return (
    <PageFrame>
      <PageHeader
        title="API keys"
        description="API keys authenticate server-to-server calls to /v1. Plaintext is shown exactly once on creation."
        actions={<IssueKeyDialog />}
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
            {keys.map((k) => (
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
                  {!k.revoked_at && <RevokeKeyButton keyId={k.id} />}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-500">
                  No keys yet. Click <span className="mono">Issue key</span> to create one.
                </td>
              </tr>
            )}
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
