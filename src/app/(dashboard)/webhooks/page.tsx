import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import { fmtDate } from "@/frontend/utils/formatters";

const WEBHOOKS = [
  {
    id: "wh_01HS88AA01",
    url: "https://hooks.acme.com/pablo/run-events",
    events: ["execution.completed", "execution.failed"],
    created_at: "2026-02-10T09:00:00Z",
    disabled_at: null,
  },
  {
    id: "wh_01HS88AA02",
    url: "https://hooks.acme.com/pablo/quota",
    events: ["quota.threshold", "subscription.updated"],
    created_at: "2026-03-02T13:12:00Z",
    disabled_at: null,
  },
];

const DELIVERIES = [
  {
    id: "whd_01",
    webhook_id: "wh_01HS88AA01",
    event: "execution.completed",
    status: "delivered",
    attempt: 1,
    last_attempt_at: "2026-04-23T06:00:12Z",
  },
  {
    id: "whd_02",
    webhook_id: "wh_01HS88AA01",
    event: "execution.failed",
    status: "delivered",
    attempt: 2,
    last_attempt_at: "2026-04-22T06:00:09Z",
  },
  {
    id: "whd_03",
    webhook_id: "wh_01HS88AA02",
    event: "quota.threshold",
    status: "retrying",
    attempt: 3,
    last_attempt_at: "2026-04-21T18:02:00Z",
  },
];

const ALL_EVENTS = [
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "quota.threshold",
  "subscription.updated",
];

export default function WebhooksPage() {
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
                {WEBHOOKS.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3">
                      <div className="mono text-xs text-ink-100 break-all">{w.url}</div>
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
                      <button className="mr-3 text-ink-300 hover:text-ink-100">Test</button>
                      <button className="text-red-400 hover:text-red-300">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold text-ink-100">Recent deliveries</h3>
          <div className="overflow-x-auto rounded-lg border border-ink-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">Webhook</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Attempt</th>
                  <th className="px-4 py-2.5 font-medium">Last attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800 bg-ink-950">
                {DELIVERIES.map((d) => (
                  <tr key={d.id}>
                    <td className="mono px-4 py-3 text-xs text-ink-200">{d.event}</td>
                    <td className="mono px-4 py-3 text-[11px] text-ink-400">{d.webhook_id}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] ${
                          d.status === "delivered"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="mono px-4 py-3 text-xs text-ink-300">#{d.attempt}</td>
                    <td className="px-4 py-3 text-xs text-ink-400">
                      {fmtDate(d.last_attempt_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside>
          <form className="flex flex-col gap-4 rounded-lg border border-ink-800 bg-ink-950 p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink-100">Register webhook</h3>
              <p className="mt-1 text-xs text-ink-500">
                We sign every request with <span className="mono">X-Pablo-Signature</span>.
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">URL</span>
              <input
                type="url"
                placeholder="https://example.com/hooks/pablo"
                className="mono rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-accent-600"
              />
            </label>

            <div>
              <span className="text-sm text-ink-300">Events</span>
              <ul className="mt-2 flex flex-col gap-2">
                {ALL_EVENTS.map((e) => (
                  <li key={e} className="flex items-center gap-2 text-xs text-ink-300">
                    <input
                      type="checkbox"
                      defaultChecked={e.startsWith("execution.")}
                      className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-900 text-accent-600"
                    />
                    <span className="mono text-ink-200">{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              className="rounded-md bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              Register
            </button>
          </form>
        </aside>
      </div>
    </PageFrame>
  );
}
