"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Agent, Skill } from "@/shared/types/agent.types";

type Role = "user" | "assistant";

interface Turn {
  id: string;
  role: Role;
  content: string;
  ts: string;
  streaming?: boolean;
  failed?: boolean;
}

export interface InitialTurn {
  id: string;
  role: Role;
  content: string;
  ts: string;
}

export default function ChatConversation({
  agent,
  initialTurns,
}: {
  agent: Agent;
  initialTurns: InitialTurn[];
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  function now(): string {
    return new Date().toISOString().slice(11, 16);
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    setError(null);

    const userId = `local-${Date.now()}`;
    const asstId = `asst-${Date.now()}`;
    setTurns((t) => [
      ...t,
      { id: userId, role: "user", content: text, ts: now() },
      { id: asstId, role: "assistant", content: "", ts: now(), streaming: true },
    ]);
    setPending(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const { event, data } = parseSseFrame(frame);
          if (!event || !data) continue;

          if (event === "delta") {
            const { content } = JSON.parse(data) as { content: string };
            setTurns((ts) =>
              ts.map((t) => (t.id === asstId ? { ...t, content: t.content + content } : t)),
            );
          } else if (event === "failed") {
            const { detail, code } = JSON.parse(data) as { detail: string; code: string };
            setError(`${code}: ${detail}`);
            setTurns((ts) =>
              ts.map((t) => (t.id === asstId ? { ...t, streaming: false, failed: true } : t)),
            );
          } else if (event === "completed") {
            setTurns((ts) =>
              ts.map((t) => (t.id === asstId ? { ...t, streaming: false } : t)),
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed.");
      setTurns((ts) =>
        ts.map((t) => (t.id === asstId ? { ...t, streaming: false, failed: true } : t)),
      );
    } finally {
      setPending(false);
      // Refresh the enclosing page so the sidebar's "last run" and the run
      // list pick up the new row.
      router.refresh();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("message") ?? "");
    if (inputRef.current) inputRef.current.value = "";
    void sendMessage(text);
  }

  function onSkillClick(label: string) {
    if (inputRef.current) {
      inputRef.current.value = label;
      inputRef.current.focus();
    }
  }

  const empty = turns.length === 0;

  return (
    <>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 md:px-6">
          <div className="text-center text-[11px] font-medium uppercase tracking-wider text-ink-500">
            <span className="bg-ink-950 px-3">
              {empty ? "Today" : "Conversation"}
            </span>
          </div>

          {empty && <Welcome agent={agent} onPick={onSkillClick} />}

          {turns.map((t) => (
            <Bubble key={t.id} agent={agent} turn={t} />
          ))}

          {error && (
            <div
              role="alert"
              className="mx-auto w-full max-w-2xl rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-ink-800 bg-ink-950 px-4 py-4 md:px-6">
        <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            name="message"
            rows={1}
            placeholder={`Message ${agent.name}…`}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = (e.target as HTMLTextAreaElement).form;
                form?.requestSubmit();
              }
            }}
            className="flex-1 resize-none rounded-md border border-ink-800 bg-ink-900 px-4 py-2.5 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex h-10 items-center justify-center rounded-md bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {pending ? "…" : "Send"}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-ink-500">
          Agents can make mistakes. Verify important info. Don't share sensitive data.
        </p>
      </footer>
    </>
  );
}

function Welcome({ agent, onPick }: { agent: Agent; onPick: (label: string) => void }) {
  return (
    <>
      {agent.intro.map((msg, i) => (
        <Bubble
          key={`intro-${i}`}
          agent={agent}
          turn={{ id: `intro-${i}`, role: "assistant", content: msg, ts: i === 0 ? "" : "" }}
        />
      ))}

      {agent.skills.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {agent.skills.map((s: Skill) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onPick(s.label)}
              className={`group flex flex-col gap-2 rounded-xl border bg-ink-900/40 p-4 text-left transition hover:bg-ink-900 ${
                s.try_first
                  ? "border-accent-600/60 bg-accent-600/5"
                  : "border-ink-800 hover:border-ink-700"
              }`}
            >
              {s.try_first && (
                <span className="inline-flex w-fit items-center rounded border border-accent-600/40 bg-accent-600/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-600">
                  Try first
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-600/10 text-[13px] text-accent-600">
                  ⚡
                </span>
                <span className="text-sm font-medium text-ink-50">{s.label}</span>
              </div>
              <span className="text-xs leading-snug text-ink-400">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Bubble({ agent, turn }: { agent: Agent; turn: Turn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-600 text-[11px] font-semibold text-white">
          {agent.name.slice(0, 1)}
        </div>
      )}
      <div className={`flex max-w-[80%] flex-col ${isUser ? "items-end" : ""}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-accent-600 text-white"
              : turn.failed
                ? "rounded-tl-sm border border-red-500/30 bg-red-500/10 text-red-200"
                : "rounded-tl-sm border border-ink-800 bg-ink-900 text-ink-100"
          }`}
        >
          {turn.content}
          {turn.streaming && !turn.content && (
            <span className="mono text-xs text-ink-500">▍ thinking…</span>
          )}
          {turn.streaming && turn.content && (
            <span className="mono ml-0.5 inline-block animate-pulse text-ink-400">▍</span>
          )}
        </div>
        {turn.ts && <div className="mt-1 pl-1 text-[10px] text-ink-500">{turn.ts}</div>}
      </div>
      {isUser && <div className="h-7 w-7 shrink-0 rounded-md bg-ink-800" />}
    </div>
  );
}

function parseSseFrame(frame: string): { event: string; data: string } {
  let event = "";
  let data = "";
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
  }
  return { event, data };
}
