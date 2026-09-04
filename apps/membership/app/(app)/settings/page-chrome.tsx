import type { ReactNode } from 'react';

// Settings-page chrome — the Pulse settings variant of Thread's canonical
// components/ui/page.tsx, trimmed to what this lane uses.

export function PageContainer({
  children,
  max = '4xl',
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
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header>
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-ink-muted">{children}</div>
  );
}
