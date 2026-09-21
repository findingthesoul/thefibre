import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { INSET, PAGE_PX, SECTION_LABEL } from './recipes.js';

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
  /** `full` for a workspace-like page that uses the whole window — Connections'
   *  Landscape columns (Sjoerd, 2026-09-14: "Why is this not full screen?"). */
  max?: 'md' | '3xl' | '4xl' | '5xl' | 'full';
  align?: 'center' | 'left';
}) {
  const MAX: Record<string, string> = {
    md: 'max-w-md',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-none',
  };
  return align === 'left' ? (
    <div className={`${MAX[max]} px-10 py-10`}>{children}</div>
  ) : (
    <div className={`mx-auto ${MAX[max]} ${PAGE_PX} py-10`}>{children}</div>
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
    // Wraps on a phone: a long name and two buttons do not fit one row at
    // 375px, and the Delete button slid off the screen (2026-09-15).
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex items-start gap-4 min-w-0">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
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
  return <div className={SECTION_LABEL}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className={`mt-3 ${INSET} p-5 text-sm text-ink-subtle`}>
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
