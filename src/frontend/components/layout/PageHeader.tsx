import Link from "next/link";

export default function PageHeader({
  crumbs,
  title,
  description,
  actions,
}: {
  crumbs?: { href?: string; label: string }[];
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-xs text-ink-500">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink-300">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span className="text-ink-700">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
