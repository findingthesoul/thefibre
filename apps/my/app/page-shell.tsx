// Every tab is the same page with different contents: a title, an optional
// line under it, and a column that never scrolls sideways at 375px.

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}) {
  return (
    // Full width, Sjoerd 2026-09-23. It was capped at max-w-2xl, which on a
    // desktop left the list in a narrow column with the rail on one side and
    // a field of empty page on the other. A timeline row is a date, a title
    // and two controls — it uses the width it is given.
    <div className="w-full px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-medium tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

/** An empty destination says so in a sentence. An empty list and a missing
 *  feature look identical otherwise, and that confusion has cost an evening
 *  here once already. */
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface-sunken p-6">
      <p className="text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{children}</p>
    </div>
  );
}
