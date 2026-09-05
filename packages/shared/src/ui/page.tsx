import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

// The page-chrome kit (extraction phase 2, docs/component-inventory.md).
// Superset of the four app copies: `align` (meet/membership sit left of the
// sidebar, Suite-style; web/thread center) and `leading` (web's avatar slot).
// Server-renderable — no hooks. Breadcrumb needs next/link, so it is a
// factory (the package keeps no Next dependency; see button.tsx).

export function PageContainer({
  children,
  max = '5xl',
  align = 'center',
}: {
  children: ReactNode;
  max?: 'md' | '3xl' | '4xl' | '5xl';
  align?: 'center' | 'left';
}) {
  const MAX: Record<string, string> = {
    md: 'max-w-md',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };
  return align === 'left' ? (
    <div className={`${MAX[max]} px-10 py-10`}>{children}</div>
  ) : (
    <div className={`mx-auto ${MAX[max]} px-8 py-10`}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  leading,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Optional element rendered to the left of the title — typically an avatar or logo. */
  leading?: ReactNode;
  actions?: ReactNode;
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

type LinkLike = (props: { href: string; className?: string; children?: ReactNode }) => ReactNode;

/** In the app: `import Link from 'next/link';`
 *  `export const Breadcrumb = createBreadcrumb(Link);` */
export function createBreadcrumb(LinkComponent: LinkLike) {
  return function Breadcrumb({ href, label }: { href: string; label: string }) {
    return (
      <nav className="mb-6 text-sm">
        <LinkComponent href={href} className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink">
          <ChevronLeft size={14} strokeWidth={1.75} />
          {label}
        </LinkComponent>
      </nav>
    );
  };
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-ink-muted">{children}</div>;
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
