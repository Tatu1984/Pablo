import Link from "next/link";
import RegisterForm from "@/frontend/components/features/auth/RegisterForm";

export default function RegisterPage() {
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

      <RegisterForm />

      <p className="mt-5 text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="text-ink-200 hover:text-white">
          Sign in
        </Link>
      </p>
    </div>
  );
}
