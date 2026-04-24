"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/shared/types";
import ThemeToggle from "@/frontend/components/ui/ThemeToggle";

const SETTINGS_LINKS = [
  { href: "/providers", label: "Providers", hint: "LLM connections & BYO keys" },
  { href: "/usage", label: "Usage", hint: "Tokens, runs, cost" },
  { href: "/webhooks", label: "Webhooks", hint: "Event deliveries" },
  { href: "/keys", label: "API keys", hint: "Server-to-server access" },
  { href: "/billing", label: "Billing", hint: "Plan & invoices" },
];

export default function Sidebar({
  agents,
  user,
  onNavigate,
}: {
  agents: Agent[];
  user: { email: string; orgName: string };
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const handle = () => onNavigate?.();

  const signOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/auth/logout", { method: "POST" });
    handle();
    router.push("/login");
    router.refresh();
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!footerRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  useEffect(() => {
    setSettingsOpen(false);
  }, [pathname]);

  const settingsActive = SETTINGS_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-ink-800 bg-ink-950">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/agents" onClick={handle} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-sm font-semibold text-white">
            P
          </span>
          <span className="text-sm font-semibold tracking-wide text-ink-100">Pablo</span>
          <span className="ml-1 rounded-full border border-accent-600/40 bg-accent-600/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-600">
            Early access
          </span>
        </Link>
      </div>

      <div className="flex items-center justify-between border-t border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <span>Agents</span>
          <span className="mono text-[11px] font-normal text-ink-500">{agents.length}</span>
        </div>
        <Link
          href="/agents/new"
          onClick={handle}
          className="inline-flex items-center gap-1 rounded-md border border-accent-600/40 bg-accent-600/10 px-2 py-1 text-[11px] font-medium text-accent-600 hover:bg-accent-600/20"
        >
          <span className="text-sm leading-none">+</span> New
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {agents.map((a) => {
          const active =
            pathname === `/agents/${a.id}` || pathname.startsWith(`/agents/${a.id}/`);
          return (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              onClick={handle}
              className={`mb-1 flex items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition ${
                active
                  ? "border-accent-600/40 bg-accent-600/10"
                  : "border-transparent hover:border-ink-800 hover:bg-ink-900"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white ${
                  active ? "bg-accent-600" : "bg-ink-800"
                }`}
              >
                {a.name.slice(0, 1)}
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span
                  className={`truncate font-medium ${
                    active ? "text-ink-50" : "text-ink-100"
                  }`}
                >
                  {a.name}
                </span>
                <span className="truncate text-[11px] text-ink-500">{a.role}</span>
              </div>
            </Link>
          );
        })}

        {agents.length === 0 && (
          <div className="px-2 py-3 text-xs text-ink-500">No agents yet.</div>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-ink-800 px-4 py-3 text-xs text-ink-400">
        <div className="h-7 w-7 rounded-full bg-ink-800" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-ink-100">{user.email}</span>
          <span className="truncate text-[11px] text-ink-500">{user.orgName}</span>
        </div>
      </div>

      <div ref={footerRef} className="relative border-t border-ink-800 p-2">
        {settingsOpen && (
          <div
            role="menu"
            aria-label="Settings"
            className="absolute bottom-[calc(100%+6px)] left-2 right-2 z-10 overflow-hidden rounded-lg border border-ink-800 bg-ink-900 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink-800 px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                Settings
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xs text-ink-500 hover:text-ink-300"
                aria-label="Close settings menu"
              >
                ×
              </button>
            </div>

            <div className="py-1">
              {SETTINGS_LINKS.map((l) => {
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    onClick={() => {
                      setSettingsOpen(false);
                      handle();
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-sm transition ${
                      active ? "bg-ink-800 text-ink-50" : "text-ink-200 hover:bg-ink-800"
                    }`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{l.label}</span>
                      <span className="text-[11px] text-ink-500">{l.hint}</span>
                    </div>
                    <span aria-hidden className="text-ink-500">
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-ink-800 px-3 py-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-500">
                Theme
              </div>
              <ThemeToggle />
            </div>
          </div>
        )}

        <div className="flex items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition ${
              settingsOpen || settingsActive
                ? "border-ink-700 bg-ink-800 text-ink-50"
                : "border-ink-800 bg-ink-900 text-ink-200 hover:bg-ink-800"
            }`}
          >
            <span aria-hidden>⚙</span>
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-800 bg-ink-900 px-2 py-1.5 text-sm text-ink-200 transition hover:bg-ink-800"
          >
            <span aria-hidden>⏻</span>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
