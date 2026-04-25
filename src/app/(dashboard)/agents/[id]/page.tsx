import Link from "next/link";
import { notFound } from "next/navigation";
import type { Agent } from "@/shared/types";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getProvider } from "@/backend/repositories/provider.repository";
import { getRunsForAgent } from "@/backend/repositories/run.repository";
import { query } from "@/backend/database/client";
import { requireSession } from "@/backend/services/session.service";
import ChatConversation, {
  type InitialTurn,
} from "@/frontend/components/features/agents/ChatConversation";

const HISTORY_LIMIT = 20;

export default async function AgentChatPage({ params }: { params: { id: string } }) {
  const { org } = await requireSession();
  const agent = await getAgent(org.id, params.id);
  if (!agent) notFound();

  const [provider, runs] = await Promise.all([
    getProvider(org.id, agent.provider_id),
    getRunsForAgent(org.id, agent.id),
  ]);
  const lastRun = runs[0];

  const initialTurns = await buildInitialTurns(agent.id);

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <ChatHeader agent={agent} providerName={provider?.name ?? null} lastRunId={lastRun?.id} />
      <ChatConversation agent={agent} initialTurns={initialTurns} />
    </div>
  );
}

async function buildInitialTurns(agentId: string): Promise<InitialTurn[]> {
  // Last N completed runs, chronological, flattened into user/assistant turns.
  const rows = await query<{
    id: string;
    input: { message?: string } | null;
    output: { message?: string } | null;
    status: string;
    queued_at: string;
  }>(
    `SELECT id, input, output, status,
            to_char(queued_at, 'HH24:MI') AS queued_at
       FROM runs
      WHERE agent_id = $1 AND status = 'completed'
      ORDER BY queued_at DESC
      LIMIT $2`,
    [agentId, HISTORY_LIMIT],
  );

  const turns: InitialTurn[] = [];
  for (const r of rows.reverse()) {
    const userMsg = r.input?.message;
    const asstMsg = r.output?.message;
    if (userMsg) turns.push({ id: `${r.id}-u`, role: "user", content: userMsg, ts: r.queued_at });
    if (asstMsg) turns.push({ id: `${r.id}-a`, role: "assistant", content: asstMsg, ts: r.queued_at });
  }
  return turns;
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
        <Link
          href={`/agents/${agent.id}/runs`}
          className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
        >
          Runs
        </Link>
        {lastRunId && (
          <Link
            href={`/agents/${agent.id}/runs/${lastRunId}`}
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
          >
            Last
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
