"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ProblemJson {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      org: String(form.get("org") ?? ""),
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/agents");
        router.refresh();
        return;
      }

      const problem: ProblemJson = await res.json().catch(() => ({}));
      if (problem.errors) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(problem.errors)) flat[k] = v[0] ?? "";
        setFieldErrors(flat);
      }
      setError(problem.detail ?? "Something went wrong. Try again.");
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      <FormField label="Organisation" name="org" error={fieldErrors.org} placeholder="Acme Inc." required />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
        placeholder="you@example.com"
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.password}
        required
        minLength={8}
        hint="Argon2id-hashed server-side. Min 8 chars."
      />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

function FormField({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  placeholder,
  required,
  minLength,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-300">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        aria-invalid={!!error}
        className={`rounded-md border bg-ink-950 px-3 py-2 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600 ${
          error ? "border-red-500/60" : "border-ink-800"
        }`}
      />
      {error ? (
        <span className="text-[11px] text-red-400">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}
