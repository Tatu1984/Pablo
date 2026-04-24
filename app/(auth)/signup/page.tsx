import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-sm font-semibold text-white">
          P
        </span>
        <span className="font-semibold text-ink-100">Pablo</span>
      </div>
      <h1 className="text-lg font-semibold text-ink-50">Create account</h1>
      <p className="mt-1 text-sm text-ink-400">
        One org is created for you on signup — you can invite teammates later.
      </p>

      <form className="mt-6 flex flex-col gap-4" action="/agents">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Organisation</span>
          <input
            type="text"
            name="org"
            required
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600"
            placeholder="Acme Inc."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm outline-none placeholder:text-ink-500 focus:border-accent-600"
          />
          <span className="text-[11px] text-ink-500">Argon2id-hashed server-side. Min 8 chars.</span>
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="text-ink-200 hover:text-white">
          Sign in
        </Link>
      </p>
    </div>
  );
}
