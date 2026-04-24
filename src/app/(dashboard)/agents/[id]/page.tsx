import Link from "next/link";
import { notFound } from "next/navigation";
import type { Agent } from "@/shared/types";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getProvider } from "@/backend/repositories/provider.repository";
import { getRunsForAgent } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function AgentChatPage({ params }: { params: { id: string } }) {
  const { org } = await requireSession();
  const agent = await getAgent(org.id, params.id);
  if (!agent) notFound();

  const [provider, runs] = await Promise.all([
    getProvider(org.id, agent.provider_id),
    getRunsForAgent(org.id, agent.id),
  ]);
  const lastRun = runs[0];

  const ts = "08:22";

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <ChatHeader agent={agent} providerName={provider?.name ?? null} lastRunId={lastRun?.id} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
          <div className="text-center text-[11px] font-medium uppercase tracking-wider text-ink-500">
            <span className="bg-ink-950 px-3">Today</span>
          </div>

          {agent.intro.map((msg, i) => (
            <Bubble key={`intro-${i}`} agent={agent} content={msg} ts={i === 0 ? ts : undefined} />
          ))}

          {agent.skills.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {agent.skills.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`group flex flex-col gap-2 rounded-xl border bg-ink-900/40 p-4 text-left transition hover:bg-ink-900 ${
                    s.try_first
                      ? "border-accent-600/60 bg-accent-600/5"
                      : "border-ink-800 hover:border-ink-700"
                  }`}
                >
                  {s.try_first && (
                    <span className="inline-flex w-fit items-center rounded border border-accent-600/40 bg-accent-600/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-500">
                      Try first
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-600/10 text-[13px] text-accent-500">
                      ⚡
                    </span>
                    <span className="text-sm font-medium text-ink-50">{s.label}</span>
                  </div>
                  <span className="text-xs leading-snug text-ink-400">{s.description}</span>
                </button>
              ))}
            </div>
          )}

          <Bubble agent={agent} content="Or just tell me what's on your mind." />
        </div>
      </div>

      <ChatInput agent={agent} />
    </div>
  );
}

function ChatHeader({
  agent,
  providerName,
  lastRunId,
}: {
  agent: Agent;
  providerName: string | null;
  lastRunId?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950 px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-600 text-sm font-semibold text-white">
          {agent.name.slice(0, 1)}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-ink-50">{agent.name}</div>
          <div className="mono truncate text-[11px] text-ink-500">
            {agent.role} · {providerName ?? "provider"} / {agent.model} ·{" "}
            {agent.current_prompt_version}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {lastRunId && (
          <Link
            href={`/agents/${agent.id}/runs/${lastRunId}`}
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
          >
            Last run
          </Link>
        )}
        <Link
          href={`/agents/${agent.id}/edit`}
          className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
        >
          Settings
        </Link>
      </div>
    </header>
  );
}

function Bubble({
  agent,
  content,
  ts,
}: {
  agent: Agent;
  content: string;
  ts?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-600 text-[11px] font-semibold text-white">
        {agent.name.slice(0, 1)}
      </div>
      <div className="flex flex-col">
        <div className="rounded-2xl rounded-tl-sm border border-ink-800 bg-ink-900 px-4 py-2.5 text-sm leading-relaxed text-ink-100">
          {content}
        </div>
        {ts && <div className="mt-1 pl-1 text-[10px] text-ink-500">{ts}</div>}
      </div>
    </div>
  );
}

function ChatInput({ agent }: { agent: Agent }) {
  return (
    <footer className="border-t border-ink-800 bg-ink-950 px-6 py-4">
      <form className="mx-auto flex max-w-3xl items-center gap-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-ink-800 bg-ink-900 text-lg text-ink-400 hover:text-ink-200"
          title="Attach"
        >
          +
        </button>
        <input
          type="text"
          placeholder={`Message ${agent.name}…`}
          className="flex-1 rounded-md border border-ink-800 bg-ink-900 px-4 py-2.5 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600"
        />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-ink-800 bg-ink-900 text-ink-400 hover:text-ink-200"
          title="Attach file"
        >
          📎
        </button>
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-600 text-white hover:bg-accent-700"
          title="Send"
        >
          ▸
        </button>
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-ink-500">
        Agents can make mistakes. Verify important info. Don't share sensitive data.
      </p>
    </footer>
  );
}
