"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import type { Agent } from "@/lib/types";

export default function AppShell({
  children,
  agents,
}: {
  children: React.ReactNode;
  agents: Agent[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const currentAgent = agents.find((a) => pathname.startsWith(`/agents/${a.id}`));
  const mobileTitle = currentAgent
    ? currentAgent.name
    : pathname === "/agents/new"
      ? "New agent"
      : pathname.startsWith("/providers")
        ? "Providers"
        : pathname.startsWith("/usage")
          ? "Usage"
          : pathname.startsWith("/billing")
            ? "Billing"
            : pathname.startsWith("/keys")
              ? "API keys"
              : pathname.startsWith("/webhooks")
                ? "Webhooks"
                : "Pablo";

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-ink-800 bg-ink-950 px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-ink-800 bg-ink-900 text-ink-200"
          aria-label="Open menu"
        >
          <span aria-hidden>☰</span>
        </button>
        <span className="truncate px-2 text-sm font-semibold text-ink-100">{mobileTitle}</span>
        <Link
          href="/agents/new"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-ink-800 bg-ink-900 text-ink-200"
          aria-label="New agent"
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
        </Link>
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar agents={agents} onNavigate={() => setOpen(false)} />
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <main className="flex flex-1 flex-col overflow-hidden pt-12 md:pt-0">{children}</main>
    </div>
  );
}
