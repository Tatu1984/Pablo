"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [dark, setDark] = useState<boolean>(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  const setTheme = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pablo-theme", next ? "dark" : "light");
    } catch {}
  };

  if (!ready) {
    // Placeholder so button doesn't flash wrong state.
    return <span className={compact ? "h-7 w-12" : "h-8 w-full"} aria-hidden />;
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setTheme(!dark)}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-800 bg-ink-900 text-ink-300 hover:text-ink-100"
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span aria-hidden>{dark ? "☀" : "☾"}</span>
      </button>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Theme"
      className="flex w-full overflow-hidden rounded-md border border-ink-800 bg-ink-900 text-[11px]"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!dark}
        onClick={() => setTheme(false)}
        className={`flex flex-1 items-center justify-center gap-1 px-2 py-1 ${
          !dark ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:text-ink-200"
        }`}
      >
        <span aria-hidden>☀</span> Light
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={dark}
        onClick={() => setTheme(true)}
        className={`flex flex-1 items-center justify-center gap-1 px-2 py-1 ${
          dark ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:text-ink-200"
        }`}
      >
        <span aria-hidden>☾</span> Dark
      </button>
    </div>
  );
}
