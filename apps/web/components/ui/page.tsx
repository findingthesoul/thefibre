import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageContainer({ children, max = '5xl' }: { children: ReactNode; max?: 'md' | '3xl' | '4xl' | '5xl' }) {
  const MAX: Record<string, string> = {
    md: 'max-w-md',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };
  return <div className={`mx-auto ${MAX[max]} px-8 py-10`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  leading,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional element rendered to the left of the title — typically an avatar or logo. */
  leading?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4 min-w-0">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function Breadcrumb({ href, label }: { href: string; label: string }) {
  return (
    <nav className="mb-6 text-sm">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        {label}
      </Link>
    </nav>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-ink-muted">{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
      {children}
    </div>
  );
}
