import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import RegisterWebhookForm from "@/frontend/components/features/webhooks/RegisterWebhookForm";
import WebhookRowActions from "@/frontend/components/features/webhooks/WebhookRowActions";
import { fmtDate } from "@/frontend/utils/formatters";
import {
  listAllWebhooks,
  listRecentDeliveries,
} from "@/backend/services/webhook.service";
import { requireSession } from "@/backend/services/session.service";

export default async function WebhooksPage() {
  const { org } = await requireSession();
  const [webhooks, deliveries] = await Promise.all([
    listAllWebhooks(org.id),
    listRecentDeliveries(org.id),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Webhooks"
        description="Registered HTTPS endpoints receive signed deliveries for terminal run events and account-level events."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-ink-100">Endpoints</h3>
          <div className="overflow-x-auto rounded-lg border border-ink-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">URL</th>
                  <th className="px-4 py-2.5 font-medium">Events</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800 bg-ink-950">
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3">
                      <div className="mono break-all text-xs text-ink-100">{w.url}</div>
                      <div className="mono text-[11px] text-ink-500">{w.id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="mono rounded bg-ink-900 px-1.5 py-0.5 text-[11px] text-ink-300"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-400">{fmtDate(w.created_at)}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      <WebhookRowActions webhookId={w.id} />
                    </td>
                  </tr>
                ))}
                {webhooks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-ink-500">
                      No webhooks yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="mb-3 mt-8 text-sm font-semibold text-ink-100">Recent deliveries</h3>
          <div className="overflow-x-auto rounded-lg border border-ink-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">URL</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Attempt</th>
                  <th className="px-4 py-2.5 font-medium">Last attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800 bg-ink-950">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="mono px-4 py-3 text-xs text-ink-200">{d.event}</td>
                    <td className="mono px-4 py-3 text-[11px] text-ink-400">{d.url}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] ${
                          d.status === "delivered"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : d.status === "failed"
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {d.status}
                        {d.last_status ? ` (${d.last_status})` : ""}
                      </span>
                    </td>
                    <td className="mono px-4 py-3 text-xs text-ink-300">#{d.attempt}</td>
                    <td className="px-4 py-3 text-xs text-ink-400">
                      {fmtDate(d.last_attempt_at)}
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-ink-500">
                      No deliveries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside>
          <RegisterWebhookForm />
        </aside>
      </div>
    </PageFrame>
  );
}
