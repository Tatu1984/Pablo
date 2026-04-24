import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "@/frontend/components/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-sm font-semibold text-white">
          P
        </span>
        <span className="font-semibold text-ink-100">Pablo</span>
      </div>
      <h1 className="text-lg font-semibold text-ink-50">Sign in</h1>
      <p className="mt-1 text-sm text-ink-400">Access your agents, runs, and keys.</p>

      <Suspense fallback={<div className="mt-6 h-40" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-5 text-center text-xs text-ink-500">
        No account?{" "}
        <Link href="/register" className="text-ink-200 hover:text-white">
          Create one
        </Link>
      </p>
    </div>
  );
}
