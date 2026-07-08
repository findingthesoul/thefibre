import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

// Settings-page chrome — copied from The Thread's components/ui/page.tsx
// (the canonical settings-hub pattern) so the Profile/Payments pages could
// be ported near-verbatim. Trimmed to the pieces the settings lane uses;
// PageContainer keeps Pulse's left-aligned px-6 rather than Thread's
// centered mx-auto so the section matches the rest of the app.

export function PageContainer({
  children,
  max = '5xl',
}: {
  children: ReactNode;
  max?: 'md' | '3xl' | '4xl' | '5xl';
}) {
  const MAX: Record<string, string> = {
    md: 'max-w-md',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };
  return <div className={`${MAX[max]} px-6 py-10`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
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
